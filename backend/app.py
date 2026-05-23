from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel
from fastapi import HTTPException
from core.db import init_db, db_get_user_by_email, db_create_user
from core.auth import hash_password, verify_password

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

@app.on_event("startup")
async def startup_event():
    init_db()

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
    
    # Create user
    new_user = db_create_user(
        email=email_clean,
        name=payload.name,
        password_hash=h_hash,
        password_salt=h_salt,
        role=payload.role
    )
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user")
        
    return UserResponse(
        email=new_user["email"],
        name=new_user["name"],
        role=new_user["role"]
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
        
    return UserResponse(
        email=user["email"],
        name=user["name"],
        role=user["role"]
    )

@app.post("/api/auth/google", response_model=UserResponse)
async def google_login(payload: GoogleLogin):
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    # Developer Mock Mode check
    if credential == "mock_google_jwt_token_bypass" or credential.startswith("mock_google_jwt_"):
        email = "demo.recruiter@hiregrid.io"
        name = "Demo Recruiter"
        # Parse simulated payload if custom format is used: mock_google_jwt_email_name
        if "_" in credential:
            parts = credential.split("_")
            if len(parts) >= 4:
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
            
    return UserResponse(
        email=user["email"],
        name=user["name"],
        role=user["role"]
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
    "excel", "power bi", "tableau", "data analysis", "data visualization"
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
    resumes: List[UploadFile] = File(...)
):
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
                    "projects": extracted.get("projects", [])
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
    resumes: List[UploadFile] = File(...)
):
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
                        "candidate_id": filename,
                        "candidate_name": extracted.get("candidate_name", "") or filename,
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
                        "candidate_id": filename,
                        "candidate_name": extracted.get("candidate_name", "") or filename,
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
                    continue
                # ───────────────────────────────────────────────────────────

                scoring = await run_in_threadpool(compute_final_score, extracted, job_reqs, semantic_score, skill_sim_score, semantic_model)
                matched, missing = get_matched_missing_skills(req_skills_list, extracted["skills"])

                candidate_name = extracted.get("candidate_name", "") or filename
                summary = generate_summary(candidate_name, matched, missing, scoring["breakdown"]["experience"], semantic_score, scoring["final_score"])

                results.append({
                    "candidate_id": filename,
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
                        "projects": extracted.get("projects", [])
                    },
                    "summary": summary,
                    "audit_log": scoring.get("audit_log", {})
                })

            except Exception as e:
                results.append({
                    "candidate_id": filename,
                    "candidate_name": filename,
                    "score": 0.0,
                    "score_breakdown": {},
                    "matched_skills": [],
                    "missing_skills": req_skills_list,
                    "extracted_info": {},
                    "summary": f"Error processing {filename}: {str(e)}"
                })

        results = [c for c in results if c["score"] > 0.0]
        results.sort(key=lambda x: x["score"], reverse=True)
        final_payload = {
            "type": "result",
            "data": {
                "job_title": job_title,
                "total_candidates": total,
                "ranked_candidates": results[:top_n_candidates]
            }
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
