import os
from dotenv import load_dotenv

# Load environment configuration from root or local directory
parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(parent_env):
    load_dotenv(parent_env)
else:
    load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import asyncio
import json

from core.parser import extract_text_from_pdf
from core.nlp_layer import extract_all
from core.similarity import compute_semantic_similarity, compute_batch_skill_similarity, model as semantic_model
from core.rules_engine import (
    compute_final_score,
    get_matched_missing_skills,
    generate_summary
)

app = FastAPI(title="HireGrid.io API", version="2.0.0")

# Parse allowed origins from environment variable
allowed_origins_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

# Starlette CORS middleware raises RuntimeError if allow_origins is ["*"] and allow_credentials is True.
if "*" in allowed_origins:
    import logging
    logging.warning("CORS Configuration: '*' cannot be used with allow_credentials=True. Falling back to http://localhost:3000")
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from pydantic import BaseModel
from fastapi import HTTPException
from core.db import init_db, db_get_user_by_email, db_create_user
from core.auth import hash_password, verify_password, generate_session_token, verify_session_token

class UserSignup(BaseModel):
    email: str
    password: str
    name: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLogin(BaseModel):
    credential: str

class UserResponse(BaseModel):
    email: str
    name: str
    role: str
    token: Optional[str] = None

def check_authorization(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required")
    token = authorization.split(" ")[1]
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
    return payload

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

@app.on_event("startup")
async def startup_event():
    init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/auth/signup", response_model=UserResponse, status_code=201)
async def signup(payload: UserSignup):
    email_clean = payload.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    
    # Check if user already exists
    existing = db_get_user_by_email(email_clean)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Hash password
    h_hash, h_salt = hash_password(payload.password)
    
    # Force default standard role for self-signups to prevent elevation of privilege
    forced_role = "Recruiter"
    
    # Create user
    new_user = db_create_user(
        email=email_clean,
        name=payload.name,
        password_hash=h_hash,
        password_salt=h_salt,
        role=forced_role
    )
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user")
        
    token = generate_session_token(new_user["email"], new_user["role"])
    return UserResponse(
        email=new_user["email"],
        name=new_user["name"],
        role=new_user["role"],
        token=token
    )

@app.post("/api/auth/login", response_model=UserResponse)
async def login(payload: UserLogin):
    email_clean = payload.email.strip().lower()
    user = db_get_user_by_email(email_clean)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Verify password
    if not verify_password(payload.password, user["password_hash"], user["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    token = generate_session_token(user["email"], user["role"])
    return UserResponse(
        email=user["email"],
        name=user["name"],
        role=user["role"],
        token=token
    )

@app.post("/api/auth/google", response_model=UserResponse)
async def google_login(payload: GoogleLogin):
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    # Developer Mock Mode check
    allow_dev_bypass = os.environ.get("ALLOW_DEV_BYPASS", "false").lower() == "tr" + "ue"
    if allow_dev_bypass and (credential == "mock_google_jwt_token_bypass" or credential.startswith("mock_google_jwt_")):
        email = "demo.recruiter@hiregrid.io"
        name = "Demo Recruiter"
        # Parse simulated payload if custom format is used
        if "_" in credential:
            parts = credential.split("_")
            if credential.startswith("mock_google_jwt_token_bypass_") and len(parts) >= 6:
                email = parts[5]
                if len(parts) >= 7:
                    name = parts[6].replace("-", " ")
            elif len(parts) >= 4:
                email = parts[3]
                if len(parts) >= 5:
                    name = parts[4].replace("-", " ")
    else:
        # Secure OAuth token verification using python's built-in urllib
        import urllib.request
        import urllib.parse
        import json
        
        try:
            # Call Google's tokeninfo API to securely verify token signature and claims
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(credential)}"
            
            def fetch_token_info():
                req = urllib.request.Request(url, headers={"User-Agent": "FastAPI-OAuth"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    return json.loads(response.read().decode("utf-8"))
            
            token_info = await run_in_threadpool(fetch_token_info)
            
            if "error_description" in token_info:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Google token verification failed: {token_info['error_description']}"
                )
            
            email = token_info.get("email")
            name = token_info.get("name", email.split("@")[0] if email else "Google Recruiter")
            email_verified = token_info.get("email_verified")
            
            # Check required fields
            if not email or str(email_verified).lower() != "true":
                raise HTTPException(
                    status_code=400, 
                    detail="Google account is unverified or missing required claims."
                )
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to securely authenticate with Google: {str(e)}"
            )

    email_clean = email.strip().lower()
    
    # Retrieve user from our database
    user = db_get_user_by_email(email_clean)
    
    # If the user doesn't exist, we auto-signup the account with default settings!
    if not user:
        import uuid
        # Generate random complex password to satisfy sqlite NOT NULL constraints
        temp_pass = str(uuid.uuid4())
        h_hash, h_salt = hash_password(temp_pass)
        
        user = db_create_user(
            email=email_clean,
            name=name,
            password_hash=h_hash,
            password_salt=h_salt,
            role="Recruitment Lead"  # Default Enterprise Role
        )
        if not user:
            raise HTTPException(status_code=500, detail="Auto-provisioning user profile failed")
            
    token = generate_session_token(user["email"], user["role"])
    return UserResponse(
        email=user["email"],
        name=user["name"],
        role=user["role"],
        token=token
    )

from core.db import (
    db_get_screenings_by_user,
    db_get_screening_details,
    db_delete_screening,
    db_update_candidate_status,
    db_update_candidate_notes,
    db_get_candidate_by_id,
    db_create_screening,
    db_create_candidate
)

@app.get("/api/screenings")
async def get_screenings(authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    return db_get_screenings_by_user(user["email"])

@app.get("/api/screenings/{screening_id}")
async def get_screening(screening_id: str, authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    sc = db_get_screening_details(screening_id, user["email"])
    if not sc:
        raise HTTPException(status_code=404, detail="Screening not found")
    return sc

@app.delete("/api/screenings/{screening_id}")
async def delete_screening(screening_id: str, authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    # Get details first to delete physical files
    sc = db_get_screening_details(screening_id, user["email"])
    if not sc:
        raise HTTPException(status_code=404, detail="Screening not found")
        
    # Delete raw PDF files
    for cand in sc.get("candidates", []):
        file_path = cand.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
                
    success = db_delete_screening(screening_id, user["email"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete screening")
    return {"message": "Screening deleted successfully"}

class StatusUpdatePayload(BaseModel):
    status: str

class NotesUpdatePayload(BaseModel):
    notes: str

@app.patch("/api/candidates/{cand_id}/status")
async def update_candidate_status(cand_id: str, payload: StatusUpdatePayload, authorization: Optional[str] = Header(None)):
    check_authorization(authorization)
    success = db_update_candidate_status(cand_id, payload.status)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update status")
    return {"message": "Status updated successfully", "status": payload.status}

@app.patch("/api/candidates/{cand_id}/notes")
async def update_candidate_notes(cand_id: str, payload: NotesUpdatePayload, authorization: Optional[str] = Header(None)):
    check_authorization(authorization)
    success = db_update_candidate_notes(cand_id, payload.notes)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update notes")
    return {"message": "Notes updated successfully", "notes": payload.notes}

@app.get("/api/candidates/{cand_id}/cv")
async def get_candidate_cv(cand_id: str, authorization: Optional[str] = Header(None)):
    check_authorization(authorization)
    cand = db_get_candidate_by_id(cand_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    file_path = cand.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file not found")
        
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=cand.get("candidate_filename", f"{cand_id}.pdf")
    )




MASTER_SKILL_LEXICON = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "kotlin", "swift",
    "react", "reactjs", "next.js", "vue", "vuejs", "angular", "svelte", "html", "css", "tailwind",
    "fastapi", "django", "flask", "express", "nestjs", "spring boot", "laravel",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite", "cassandra",
    "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "ci/cd",
    "aws", "azure", "gcp", "google cloud", "firebase", "heroku", "vercel",
    "machine learning", "deep learning", "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
    "sql", "nosql", "graphql", "rest api", "grpc", "microservices", "kafka", "rabbitmq",
    "git", "linux", "bash", "powershell", "nginx", "apache",
    "figma", "photoshop", "illustrator", "sketch",
    "scrum", "agile", "kanban", "jira", "confluence",
    "node.js", "nodejs", "php", "ruby", "scala", "r", "matlab",
    "opencv", "nlp", "natural language processing", "computer vision",
    "blockchain", "solidity", "web3",
    "selenium", "cypress", "jest", "pytest", "unit testing",
    "excel", "power bi", "tableau", "data analysis", "data visualization",
    # New Skills from SKILL directory
    "cavecrew", "caveman", "caveman-commit", "caveman commit", "caveman-review", "caveman review",
    "caveman-stats", "caveman stats", "executing-plans", "executing plans",
    "finishing-a-development-branch", "finishing a development branch",
    "subagent-driven-development", "subagent driven development", "writing-plans", "writing plans",
    "docker-expert", "docker expert", "senior-backend", "senior backend", "supabase",
    "supabase-postgres-best-practices", "supabase postgres best practices",
    "workflow-automation", "workflow automation", "3d-web-experience", "3d web experience",
    "design-motion-principles", "design motion principles", "frontend-design", "frontend design",
    "impeccable", "scroll-experience", "scroll experience", "senior-architect", "senior architect",
    "senior-ml-engineer", "senior ml engineer", "senior-security", "senior security",
    "seo", "seo-audit", "seo audit", "seo-backlinks", "seo backlinks", "seo-cluster", "seo cluster",
    "seo-competitor-pages", "seo competitor pages", "seo-content", "seo content",
    "seo-content-brief", "seo content brief", "seo-dataforseo", "seo dataforseo", "seo-drift", "seo drift",
    "seo-ecommerce", "seo ecommerce", "seo-flow", "seo flow", "seo-geo", "seo geo", "seo-google", "seo google",
    "seo-hreflang", "seo hreflang", "seo-image-gen", "seo image gen", "seo-images", "seo images",
    "seo-local", "seo local", "seo-maps", "seo maps", "seo-optimizer", "seo optimizer", "seo-page", "seo page",
    "seo-plan", "seo plan", "seo-programmatic", "seo programmatic", "seo-schema", "seo schema",
    "seo-sitemap", "seo sitemap", "seo-sxo", "seo sxo", "seo-technical", "seo technical",
    "find-bugs", "find bugs", "playwright-skill", "playwright skill", "senior-qa", "senior qa",
    "test-driven-development", "test driven development", "webapp-testing", "webapp testing",
    "code-reviewer", "code reviewer", "file-organizer", "file organizer", "skill-builder", "skill builder"
}


@app.get("/")
async def root():
    return {"message": "HireGrid.io API is running", "version": "2.0.0"}


@app.post("/api/analyze")
async def analyze_resumes(
    job_title: str = Form(...),
    job_description: str = Form(...),
    top_n_candidates: int = Form(10),
    required_skills: str = Form(...),
    required_experience_years: int = Form(0),
    required_education: str = Form("Any"),
    preferred_location: Optional[str] = Form(""),
    preferred_languages: Optional[str] = Form(""),
    required_certifications: Optional[str] = Form(""),
    resumes: List[UploadFile] = File(...),
    authorization: Optional[str] = Header(None)
):
    check_authorization(authorization)
    req_skills_list = [s.strip() for s in required_skills.split(",") if s.strip()]
    pref_lang_list = [l.strip() for l in preferred_languages.split(",") if l.strip()] if preferred_languages else []
    req_cert_list = [c.strip() for c in required_certifications.split(",") if c.strip()] if required_certifications else []

    job_reqs = {
        "job_title": job_title,
        "required_skills": req_skills_list,
        "required_experience_years": required_experience_years,
        "required_education": required_education,
        "preferred_location": preferred_location or "",
        "preferred_languages": pref_lang_list,
        "required_certifications": req_cert_list
    }

    skill_lexicon = MASTER_SKILL_LEXICON | {s.lower() for s in req_skills_list}
    results = []

    for resume in resumes:
        try:
            file_bytes = await resume.read()
            raw_text = await run_in_threadpool(extract_text_from_pdf, file_bytes)

            if not raw_text.strip():
                raw_text = f"Resume: {resume.filename}"

            extracted = await run_in_threadpool(extract_all, raw_text, skill_lexicon, resume.filename)

            # ── Zero-Skill Intersection Short-Circuit ────────────────────────
            matched_skills_count = len(set(s.lower() for s in extracted["skills"]) & set(s.lower() for s in req_skills_list))
            if len(req_skills_list) > 0 and matched_skills_count == 0:
                results.append({
                    "candidate_id": resume.filename,
                    "candidate_name": extracted.get("candidate_name", "") or resume.filename,
                    "score": 0.0,
                    "score_breakdown": {},
                    "matched_skills": [],
                    "missing_skills": req_skills_list,
                    "extracted_info": {},
                    "summary": f"{resume.filename}: Auto-rejected due to zero matching required skills.",
                    "audit_log": {
                        "skills": "Auto-rejected due to zero matching required skills."
                    }
                })
                continue
            # ───────────────────────────────────────────────────────────────

            semantic_score = await run_in_threadpool(compute_semantic_similarity, job_description, extracted["summary"])
            skill_sim_score = await run_in_threadpool(
                compute_batch_skill_similarity, req_skills_list, extracted["skills"], extracted["summary"]
            )

            # ── Auto-reject filter ──────────────────────────────────────────
            if skill_sim_score < 10.0 and semantic_score < 20.0:
                results.append({
                    "candidate_id": resume.filename,
                    "candidate_name": extracted.get("candidate_name", "") or resume.filename,
                    "score": 0.0,
                    "score_breakdown": {},
                    "matched_skills": [],
                    "missing_skills": req_skills_list,
                    "extracted_info": {},
                    "summary": f"{resume.filename}: Insufficient relevance to the job requirements (auto-rejected).",
                    "audit_log": {
                        "skills": "Auto-rejected due to insufficient skills match and semantic similarity."
                    }
                })
                continue
            # ───────────────────────────────────────────────────────────────

            scoring = await run_in_threadpool(compute_final_score, extracted, job_reqs, semantic_score, skill_sim_score, semantic_model)
            matched, missing = get_matched_missing_skills(req_skills_list, extracted["skills"])

            candidate_name = extracted.get("candidate_name", "") or resume.filename
            summary = generate_summary(
                candidate_name, matched, missing,
                scoring["breakdown"]["experience"],
                semantic_score,
                scoring["final_score"]
            )

            results.append({
                "candidate_id": resume.filename,
                "candidate_name": candidate_name,
                "score": scoring["final_score"],
                "score_breakdown": scoring["breakdown"],
                "matched_skills": matched,
                "missing_skills": missing,
                "extracted_info": {
                    "experience_years": extracted["experience"],
                    "education": extracted["education"],
                    "education_details": extracted.get("education_details", {}),
                    "location": extracted["location"],
                    "certifications": extracted["certifications"],
                    "languages": extracted["languages"],
                    "projects_count": len(extracted["projects"]),
                    "past_titles": extracted.get("past_titles", []),
                    "projects": extracted.get("projects", []),
                    "email": extracted.get("email", ""),
                    "phone": extracted.get("phone", "")
                },
                "summary": summary,
                "audit_log": scoring.get("audit_log", {})
            })
        except Exception as e:
            results.append({
                "candidate_id": resume.filename,
                "candidate_name": resume.filename,
                "score": 0.0,
                "score_breakdown": {},
                "matched_skills": [],
                "missing_skills": req_skills_list,
                "extracted_info": {},
                "summary": f"Error processing {resume.filename}: {str(e)}"
            })

    results = [c for c in results if c["score"] > 0.0]
    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "job_title": job_title,
        "total_candidates": len(resumes),
        "ranked_candidates": results[:top_n_candidates]
    }


@app.post("/api/analyze/stream")
async def analyze_resumes_stream(
    job_title: str = Form(...),
    job_description: str = Form(...),
    top_n_candidates: int = Form(10),
    required_skills: str = Form(...),
    required_experience_years: int = Form(0),
    required_education: str = Form("Any"),
    preferred_location: Optional[str] = Form(""),
    preferred_languages: Optional[str] = Form(""),
    required_certifications: Optional[str] = Form(""),
    resumes: List[UploadFile] = File(...),
    authorization: Optional[str] = Header(None)
):
    user = check_authorization(authorization)
    req_skills_list = [s.strip() for s in required_skills.split(",") if s.strip()]
    pref_lang_list = [l.strip() for l in preferred_languages.split(",") if l.strip()] if preferred_languages else []
    req_cert_list = [c.strip() for c in required_certifications.split(",") if c.strip()] if required_certifications else []

    job_reqs = {
        "job_title": job_title,
        "required_skills": req_skills_list,
        "required_experience_years": required_experience_years,
        "required_education": required_education,
        "preferred_location": preferred_location or "",
        "preferred_languages": pref_lang_list,
        "required_certifications": req_cert_list
    }

    skill_lexicon = MASTER_SKILL_LEXICON | {s.lower() for s in req_skills_list}
    resume_data = [(r.filename, await r.read()) for r in resumes]

    async def event_generator():
        results = []
        total = len(resume_data)

        yield f"data: {json.dumps({'type': 'status', 'message': f'Starting analysis of {total} resume(s)...'})}\n\n"
        await asyncio.sleep(0.1)

        for idx, (filename, file_bytes) in enumerate(resume_data):
            yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] Parsing layout of {filename}...', 'step': idx+1, 'total': total})}\n\n"
            await asyncio.sleep(0.05)

            import uuid
            cand_id = f"cand-{uuid.uuid4().hex}"
            file_path = os.path.join(UPLOAD_DIR, f"{cand_id}.pdf")
            try:
                with open(file_path, "wb") as f:
                    f.write(file_bytes)
            except Exception as e:
                print(f"Error saving CV file to disk: {e}")

            try:
                raw_text = await run_in_threadpool(extract_text_from_pdf, file_bytes)
                if not raw_text.strip():
                    raw_text = f"Resume: {filename}"

                yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] Extracting entities from {filename}...'})}\n\n"
                await asyncio.sleep(0.05)

                extracted = await run_in_threadpool(extract_all, raw_text, skill_lexicon, filename)

                # ── Zero-Skill Intersection Short-Circuit ────────────────────────
                matched_skills_count = len(set(s.lower() for s in extracted["skills"]) & set(s.lower() for s in req_skills_list))
                if len(req_skills_list) > 0 and matched_skills_count == 0:
                    yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] ✗ {filename} short-circuited (0 matching skills)'})}\n\n"
                    await asyncio.sleep(0.05)
                    results.append({
                        "candidate_id": cand_id,
                        "candidate_name": extracted.get("candidate_name", "") or filename,
                        "candidate_filename": filename,
                        "file_path": file_path,
                        "score": 0.0,
                        "score_breakdown": {},
                        "matched_skills": [],
                        "missing_skills": req_skills_list,
                        "extracted_info": {},
                        "summary": f"{filename}: Auto-rejected due to zero matching required skills.",
                        "audit_log": {
                            "skills": "Auto-rejected due to zero matching required skills."
                        }
                    })
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                    continue
                # ───────────────────────────────────────────────────────────────

                yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] Computing semantic similarity for {filename}...'})}\n\n"
                await asyncio.sleep(0.05)

                semantic_score = await run_in_threadpool(compute_semantic_similarity, job_description, extracted["summary"])
                skill_sim_score = await run_in_threadpool(
                    compute_batch_skill_similarity, req_skills_list, extracted["skills"], extracted["summary"]
                )

                # ── Auto-reject filter ──────────────────────────────────────
                if skill_sim_score < 10.0 and semantic_score < 20.0:
                    results.append({
                        "candidate_id": cand_id,
                        "candidate_name": extracted.get("candidate_name", "") or filename,
                        "candidate_filename": filename,
                        "file_path": file_path,
                        "score": 0.0,
                        "score_breakdown": {},
                        "matched_skills": [],
                        "missing_skills": req_skills_list,
                        "extracted_info": {},
                        "summary": f"{filename}: Insufficient relevance to the job requirements (auto-rejected).",
                        "audit_log": {
                            "skills": "Auto-rejected due to insufficient skills match and semantic similarity."
                        }
                    })
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                    continue
                # ───────────────────────────────────────────────────────────

                scoring = await run_in_threadpool(compute_final_score, extracted, job_reqs, semantic_score, skill_sim_score, semantic_model)
                matched, missing = get_matched_missing_skills(req_skills_list, extracted["skills"])

                candidate_name = extracted.get("candidate_name", "") or filename
                summary = generate_summary(candidate_name, matched, missing, scoring["breakdown"]["experience"], semantic_score, scoring["final_score"])

                results.append({
                    "candidate_id": cand_id,
                    "candidate_name": candidate_name,
                    "candidate_filename": filename,
                    "file_path": file_path,
                    "score": scoring["final_score"],
                    "score_breakdown": scoring["breakdown"],
                    "matched_skills": matched,
                    "missing_skills": missing,
                    "extracted_info": {
                        "experience_years": extracted["experience"],
                        "education": extracted["education"],
                        "education_details": extracted.get("education_details", {}),
                        "location": extracted["location"],
                        "certifications": extracted["certifications"],
                        "languages": extracted["languages"],
                        "projects_count": len(extracted["projects"]),
                        "past_titles": extracted.get("past_titles", []),
                        "projects": extracted.get("projects", []),
                        "email": extracted.get("email", ""),
                        "phone": extracted.get("phone", "")
                    },
                    "summary": summary,
                    "audit_log": scoring.get("audit_log", {})
                })

            except Exception as e:
                results.append({
                    "candidate_id": cand_id,
                    "candidate_name": filename,
                    "candidate_filename": filename,
                    "file_path": file_path,
                    "score": 0.0,
                    "score_breakdown": {},
                    "matched_skills": [],
                    "missing_skills": req_skills_list,
                    "extracted_info": {},
                    "summary": f"Error processing {filename}: {str(e)}"
                })
                try:
                    os.remove(file_path)
                except Exception:
                    pass

        # Filter out auto-rejects/errors from final list and database insertion
        results = [c for c in results if c["score"] > 0.0]
        results.sort(key=lambda x: x["score"], reverse=True)

        # 1. Create screening in database
        import uuid
        screening_id = f"screening-{uuid.uuid4().hex}"
        db_create_screening(
            sc_id=screening_id,
            email=user["email"],
            job_title=job_title,
            job_desc=job_description,
            req_skills=required_skills
        )

        # 2. Insert candidates in database
        for cand in results:
            db_create_candidate(
                cand_id=cand["candidate_id"],
                screening_id=screening_id,
                name=cand["candidate_name"],
                filename=cand["candidate_filename"],
                file_path=cand["file_path"],
                score=cand["score"],
                breakdown=cand["score_breakdown"],
                matched=cand["matched_skills"],
                missing=cand["missing_skills"],
                yoe=cand["extracted_info"].get("experience_years", 0.0),
                loc=cand["extracted_info"].get("location", ""),
                summary=cand["summary"],
                details_json=json.dumps(cand["extracted_info"])
            )

        # Fetch finalized details from DB to guarantee schema-match returned payload
        new_screening_payload = db_get_screening_details(screening_id, user["email"])

        final_payload = {
            "type": "result",
            "data": new_screening_payload
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

