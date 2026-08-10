import os
from dotenv import load_dotenv

# Load environment configuration from root or local directory
parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(parent_env):
    load_dotenv(parent_env)
else:
    load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import asyncio
import json
import uuid
import secrets

from core.parser import extract_text_from_pdf
from core.nlp_layer import extract_all
from core.similarity import compute_semantic_similarity, compute_batch_skill_similarity, model as semantic_model
from core.skill_weights import parse_skill_weights
from core.rules_engine import (
    compute_final_score,
    get_matched_missing_skills,
    generate_summary
)

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Replaces the deprecated @app.on_event("startup") hook.
    from core.db import init_db as _init_db
    _init_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield


app = FastAPI(title="HireGrid.io API", version="2.0.0", lifespan=lifespan)

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

# ── Login throttling ──────────────────────────────────────────────────────────
# Fixed-window counter keyed by client IP + email. In-process only: it protects a
# single-worker deployment (which is how this ships) but does not coordinate
# across replicas. Put a gateway-level limiter in front for multi-worker setups.
import time as _time
import threading as _threading
from collections import defaultdict as _defaultdict

LOGIN_MAX_ATTEMPTS = int(os.environ.get("LOGIN_MAX_ATTEMPTS", "10"))
LOGIN_WINDOW_SECONDS = int(os.environ.get("LOGIN_WINDOW_SECONDS", "300"))

_login_attempts: dict = _defaultdict(list)
_login_lock = _threading.Lock()


def _rate_limit_login(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}|{email.strip().lower()}"
    now = _time.monotonic()
    cutoff = now - LOGIN_WINDOW_SECONDS

    with _login_lock:
        recent = [t for t in _login_attempts[key] if t > cutoff]
        if len(recent) >= LOGIN_MAX_ATTEMPTS:
            retry_after = int(LOGIN_WINDOW_SECONDS - (now - recent[0])) + 1
            _login_attempts[key] = recent
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )
        recent.append(now)
        _login_attempts[key] = recent

        # Opportunistic sweep so the dict cannot grow without bound.
        if len(_login_attempts) > 10000:
            for k in [k for k, v in _login_attempts.items() if not any(t > cutoff for t in v)]:
                del _login_attempts[k]


def _clear_login_attempts(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    with _login_lock:
        _login_attempts.pop(f"{client_ip}|{email.strip().lower()}", None)


def check_authorization(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required")
    token = authorization.split(" ")[1]
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
    return payload

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

# Maximum accepted resume size. nginx caps the whole request at 100M; this bounds
# any single file so one oversized upload cannot exhaust disk.
MAX_RESUME_BYTES = int(os.environ.get("MAX_RESUME_BYTES", str(15 * 1024 * 1024)))

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
    
    # Validate role to prevent elevation of privilege but allow valid choices
    valid_roles = {"Recruitment Lead", "Recruitment Director", "Technical Recruiter", "HR Manager", "Recruiter"}
    user_role = payload.role.strip()
    if user_role not in valid_roles:
        user_role = "Recruitment Lead"
    
    # Create user
    new_user = db_create_user(
        email=email_clean,
        name=payload.name,
        password_hash=h_hash,
        password_salt=h_salt,
        role=user_role
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
async def login(payload: UserLogin, request: Request):
    email_clean = payload.email.strip().lower()
    _rate_limit_login(request, email_clean)

    user = db_get_user_by_email(email_clean)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    if not verify_password(payload.password, user["password_hash"], user["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Only a successful login clears the counter, so failures keep accumulating.
    _clear_login_attempts(request, email_clean)
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

    # Developer mock mode. This accepts an unsigned, self-asserted email, so it
    # is a complete authentication bypass — it must never be reachable in
    # production, regardless of how ALLOW_DEV_BYPASS is set.
    is_production = os.environ.get("ENV", "development").strip().lower() == "production"
    allow_dev_bypass = (
        not is_production
        and os.environ.get("ALLOW_DEV_BYPASS", "false").strip().lower() == "true"
    )
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
        # OAuth accounts never authenticate by password; this only satisfies the
        # NOT NULL constraint with a value nobody can guess or use.
        temp_pass = secrets.token_urlsafe(32)
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
    db_get_candidate_owned,
    db_create_screening,
    db_create_candidate,
    db_get_analytics
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

ALLOWED_CANDIDATE_STATUSES = {"Applied", "Screening", "Shortlisted", "Interview", "Offer", "Hired", "Rejected", "Auto-Rejected"}


@app.patch("/api/candidates/{cand_id}/status")
async def update_candidate_status(cand_id: str, payload: StatusUpdatePayload, authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    status_clean = payload.status.strip()
    if status_clean not in ALLOWED_CANDIDATE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(sorted(ALLOWED_CANDIDATE_STATUSES))}",
        )
    # Ownership is enforced inside the UPDATE, so a candidate belonging to
    # another user matches no rows and reads back as 404.
    if not db_update_candidate_status(cand_id, status_clean, user["email"]):
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Status updated successfully", "status": status_clean}

@app.patch("/api/candidates/{cand_id}/notes")
async def update_candidate_notes(cand_id: str, payload: NotesUpdatePayload, authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    if not db_update_candidate_notes(cand_id, payload.notes, user["email"]):
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"message": "Notes updated successfully", "notes": payload.notes}

@app.get("/api/candidates/{cand_id}/cv")
async def get_candidate_cv(cand_id: str, authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    cand = db_get_candidate_owned(cand_id, user["email"])
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    file_path = cand.get("file_path")
    if not file_path:
        raise HTTPException(status_code=404, detail="Resume file not found")

    # Defence in depth: the stored path is server-generated, but resolving it and
    # confirming it sits under UPLOAD_DIR means a tampered row still cannot read
    # arbitrary files off disk.
    resolved = os.path.realpath(file_path)
    if os.path.commonpath([resolved, os.path.realpath(UPLOAD_DIR)]) != os.path.realpath(UPLOAD_DIR):
        raise HTTPException(status_code=404, detail="Resume file not found")
    if not os.path.exists(resolved):
        raise HTTPException(status_code=404, detail="Resume file not found")

    return FileResponse(
        path=resolved,
        media_type="application/pdf",
        filename=cand.get("candidate_filename", f"{cand_id}.pdf")
    )


@app.get("/api/analytics")
async def get_analytics(authorization: Optional[str] = Header(None)):
    user = check_authorization(authorization)
    return db_get_analytics(user["email"])




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
    "seo", "content marketing", "copywriting", "technical writing",
}


@app.get("/")
async def root():
    return {"message": "HireGrid.io API is running", "version": "2.0.0"}


@app.get("/api/system")
async def system_status():
    """
    What the engine is actually running.

    The sidebar previously hardcoded these three lines, so it reported
    "spaCy Active" for a library that is no longer installed and "SQLite
    Connected" regardless of which database was in use. A status panel that
    cannot be wrong is not a status panel.
    """
    from core.db import USE_SQLITE
    from core.similarity import MODEL_NAME

    return {
        "version": app.version,
        "extraction": "Rule-based",
        "database": "SQLite" if USE_SQLITE else "PostgreSQL",
        "embedding_model": MODEL_NAME,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Analysis pipeline
# ──────────────────────────────────────────────────────────────────────────────

# Relevance floor. A candidate below BOTH thresholds is recorded as auto-rejected
# rather than ranked. Rejections are kept (not discarded) so a recruiter can see
# and audit who was filtered out and why.
AUTO_REJECT_SKILL_SIM = float(os.environ.get("AUTO_REJECT_SKILL_SIM", "10.0"))
AUTO_REJECT_SEMANTIC = float(os.environ.get("AUTO_REJECT_SEMANTIC", "20.0"))

STATUS_AUTO_REJECTED = "Auto-Rejected"
STATUS_APPLIED = "Applied"


def _build_job_reqs(job_title, required_skills, required_experience_years,
                    required_education, preferred_location, preferred_languages,
                    required_certifications):
    # Importance markers ("Python!", "Jira?") are stripped here, so everything
    # downstream — matching, display, storage — sees ordinary skill names.
    req_skills_list, skill_weights = parse_skill_weights(required_skills)
    pref_lang_list = [l.strip() for l in (preferred_languages or "").split(",") if l.strip()]
    req_cert_list = [c.strip() for c in (required_certifications or "").split(",") if c.strip()]

    return req_skills_list, {
        "job_title": job_title,
        "required_skills": req_skills_list,
        "skill_weights": skill_weights,
        "required_experience_years": required_experience_years,
        "required_education": required_education,
        "preferred_location": preferred_location or "",
        "preferred_languages": pref_lang_list,
        "required_certifications": req_cert_list,
    }


def _rejection_record(cand_id, filename, candidate_name, req_skills_list, reason,
                      file_path=None, extracted=None):
    """Uniform shape for a candidate that did not clear the relevance floor."""
    extracted_info = {}
    if extracted:
        extracted_info = {
            "experience_years": extracted.get("experience", 0.0),
            "education": extracted.get("education", "Unknown"),
            "location": extracted.get("location", ""),
            "email": extracted.get("email", ""),
            "phone": extracted.get("phone", ""),
        }
    return {
        "candidate_id": cand_id,
        "candidate_name": candidate_name or filename,
        "candidate_filename": filename,
        "file_path": file_path,
        "score": 0.0,
        "score_breakdown": {},
        "matched_skills": [],
        "missing_skills": req_skills_list,
        "extracted_info": extracted_info,
        "summary": f"{filename}: {reason}",
        "status": STATUS_AUTO_REJECTED,
        "audit_log": {"skills": reason},
    }


def _score_one_candidate(raw_text, filename, cand_id, skill_lexicon, req_skills_list,
                         job_reqs, job_description, file_path=None):
    """
    Full extraction + scoring for a single resume.

    Returns (record, is_ranked). `is_ranked` is False for auto-rejections, which
    are still returned so they can be surfaced and stored.
    """
    extracted = extract_all(raw_text, skill_lexicon, filename)
    candidate_name = extracted.get("candidate_name", "") or filename

    # Scored against section chunks rather than a leading excerpt, so relevant
    # experience further down a multi-page CV still counts.
    semantic_score = compute_semantic_similarity(
        job_description, extracted["summary"], extracted.get("chunks")
    )
    skill_sim_score = compute_batch_skill_similarity(
        req_skills_list, extracted["skills"], extracted["summary"],
        skill_weights=job_reqs.get("skill_weights"),
    )

    # Relevance floor is evaluated on semantic signal, never on exact string
    # overlap alone: "ReactJS" vs "React" is a vocabulary difference, not a
    # missing skill, and rejecting on it discards qualified candidates before
    # the semantic layer that exists to catch exactly that case.
    if skill_sim_score < AUTO_REJECT_SKILL_SIM and semantic_score < AUTO_REJECT_SEMANTIC:
        return _rejection_record(
            cand_id, filename, candidate_name, req_skills_list,
            "Insufficient relevance to the job requirements (auto-rejected).",
            file_path=file_path, extracted=extracted,
        ), False

    scoring = compute_final_score(extracted, job_reqs, semantic_score, skill_sim_score, semantic_model)
    matched, missing = get_matched_missing_skills(req_skills_list, extracted["skills"])
    summary = generate_summary(
        candidate_name, matched, missing,
        scoring["breakdown"]["experience"], semantic_score, scoring["final_score"],
    )

    return {
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
            "phone": extracted.get("phone", ""),
        },
        "summary": summary,
        "status": STATUS_APPLIED,
        "audit_log": scoring.get("audit_log", {}),
    }, True


async def _spool_upload(upload: UploadFile, dest_path: str) -> int:
    """
    Copy an upload to disk in chunks.

    Reading every file fully into memory first means a 100-CV batch holds the
    entire batch in RAM before any work starts. Returns bytes written.
    """
    total = 0
    with open(dest_path, "wb") as out:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_RESUME_BYTES:
                out.close()
                raise ValueError(
                    f"File exceeds the {MAX_RESUME_BYTES // (1024 * 1024)}MB limit"
                )
            out.write(chunk)
    return total


def _read_file_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


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
    """Stateless scoring endpoint: ranks the batch without persisting anything."""
    check_authorization(authorization)
    req_skills_list, job_reqs = _build_job_reqs(
        job_title, required_skills, required_experience_years, required_education,
        preferred_location, preferred_languages, required_certifications,
    )
    skill_lexicon = MASTER_SKILL_LEXICON | {s.lower() for s in req_skills_list}

    ranked, rejected = [], []

    for resume in resumes:
        tmp_path = os.path.join(UPLOAD_DIR, f"tmp-{uuid.uuid4().hex}.pdf")
        try:
            await _spool_upload(resume, tmp_path)
            raw_text = await run_in_threadpool(extract_text_from_pdf, _read_file_bytes(tmp_path))
            if not raw_text.strip():
                raw_text = f"Resume: {resume.filename}"

            record, is_ranked = await run_in_threadpool(
                _score_one_candidate, raw_text, resume.filename, resume.filename,
                skill_lexicon, req_skills_list, job_reqs, job_description,
            )
            (ranked if is_ranked else rejected).append(record)
        except Exception as e:
            rejected.append(_rejection_record(
                resume.filename, resume.filename, resume.filename, req_skills_list,
                f"Error processing file: {e}",
            ))
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    ranked.sort(key=lambda x: x["score"], reverse=True)

    return {
        "job_title": job_title,
        "total_candidates": len(resumes),
        "ranked_candidates": ranked[:top_n_candidates],
        # Rejections are reported, not silently dropped: a screening tool must be
        # able to show who was filtered out and on what grounds.
        "rejected_candidates": rejected,
        "total_ranked": len(ranked),
        "total_rejected": len(rejected),
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
    """Persisting scoring endpoint with an SSE progress feed."""
    user = check_authorization(authorization)
    req_skills_list, job_reqs = _build_job_reqs(
        job_title, required_skills, required_experience_years, required_education,
        preferred_location, preferred_languages, required_certifications,
    )
    skill_lexicon = MASTER_SKILL_LEXICON | {s.lower() for s in req_skills_list}

    # Spool uploads to disk up front. The request body is only readable during
    # the handler, but the generator below runs after it returns.
    spooled = []
    for resume in resumes:
        cand_id = f"cand-{uuid.uuid4().hex}"
        file_path = os.path.join(UPLOAD_DIR, f"{cand_id}.pdf")
        try:
            await _spool_upload(resume, file_path)
            spooled.append((cand_id, resume.filename, file_path, None))
        except Exception as e:
            try:
                os.remove(file_path)
            except OSError:
                pass
            spooled.append((cand_id, resume.filename, None, str(e)))

    async def event_generator():
        ranked, rejected = [], []
        total = len(spooled)

        yield f"data: {json.dumps({'type': 'status', 'message': f'Starting analysis of {total} resume(s)...'})}\n\n"
        await asyncio.sleep(0.1)

        for idx, (cand_id, filename, file_path, spool_error) in enumerate(spooled):
            yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] Parsing layout of {filename}...', 'step': idx+1, 'total': total})}\n\n"
            await asyncio.sleep(0.05)

            if spool_error:
                rejected.append(_rejection_record(
                    cand_id, filename, filename, req_skills_list,
                    f"Upload failed: {spool_error}",
                ))
                continue

            try:
                raw_text = await run_in_threadpool(extract_text_from_pdf, _read_file_bytes(file_path))
                if not raw_text.strip():
                    raw_text = f"Resume: {filename}"

                yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] Scoring {filename}...'})}\n\n"
                await asyncio.sleep(0.05)

                record, is_ranked = await run_in_threadpool(
                    _score_one_candidate, raw_text, filename, cand_id,
                    skill_lexicon, req_skills_list, job_reqs, job_description, file_path,
                )
                if is_ranked:
                    ranked.append(record)
                else:
                    rejected.append(record)
                    yield f"data: {json.dumps({'type': 'progress', 'message': f'[{idx+1}/{total}] {filename} auto-rejected (below relevance floor)'})}\n\n"
                    await asyncio.sleep(0.05)

            except Exception as e:
                rejected.append(_rejection_record(
                    cand_id, filename, filename, req_skills_list,
                    f"Error processing file: {e}", file_path=file_path,
                ))

        ranked.sort(key=lambda x: x["score"], reverse=True)

        # top_n_candidates caps what is persisted and returned. Previously the
        # parameter was accepted and then ignored on this endpoint.
        kept = ranked[:top_n_candidates]
        dropped = ranked[top_n_candidates:]

        # Files for candidates that will not be stored are removed, so uploads/
        # does not accumulate orphans.
        for record in dropped:
            if record.get("file_path"):
                try:
                    os.remove(record["file_path"])
                except OSError:
                    pass

        screening_id = f"screening-{uuid.uuid4().hex}"
        db_create_screening(
            sc_id=screening_id,
            email=user["email"],
            job_title=job_title,
            job_desc=job_description,
            req_skills=req_skills_list,
        )

        for cand in kept + rejected:
            db_create_candidate(
                cand_id=cand["candidate_id"],
                screening_id=screening_id,
                name=cand["candidate_name"],
                filename=cand["candidate_filename"],
                file_path=cand.get("file_path") or "",
                score=cand["score"],
                breakdown=cand["score_breakdown"],
                matched=cand["matched_skills"],
                missing=cand["missing_skills"],
                yoe=cand["extracted_info"].get("experience_years", 0.0),
                loc=cand["extracted_info"].get("location", ""),
                summary=cand["summary"],
                details_json=json.dumps(cand["extracted_info"]),
                status=cand.get("status", STATUS_APPLIED),
            )

        new_screening_payload = db_get_screening_details(screening_id, user["email"])
        yield f"data: {json.dumps({'type': 'result', 'data': new_screening_payload})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/screenings/{screening_id}/report")
async def get_screening_report(screening_id: str, user: dict = Depends(check_authorization)):
    sc = db_get_screening_details(screening_id, user["email"])
    if not sc:
        raise HTTPException(status_code=404, detail="Screening not found")
    
    candidates = sc.get("candidates", [])
    total_count = len(candidates)
    if total_count == 0:
        avg_score = 0.0
        max_score = 0.0
        shortlist_count = 0
    else:
        scores = [c["score"] for c in candidates]
        avg_score = round(sum(scores) / total_count, 1)
        max_score = round(max(scores), 1)
        shortlist_count = sum(1 for c in candidates if c["score"] >= 80)
        
    report = {
        "title": sc.get("job_title"),
        "screening_id": screening_id,
        "created_at": sc.get("created_at"),
        "total_candidates": total_count,
        "metrics": {
            "average_score": avg_score,
            "max_score": max_score,
            "shortlist_yield_percent": round((shortlist_count / total_count * 100), 1) if total_count > 0 else 0
        },
        "required_skills": sc.get("required_skills", []),
        "top_candidates": [
            {
                "name": c["candidate_name"],
                "score": c["score"],
                "yoe": c.get("extracted_info", {}).get("experience_years", 0),
                "matched_skills": c["matched_skills"],
                "summary": c["summary"]
            }
            for c in candidates[:5]
        ]
    }
    return report


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

