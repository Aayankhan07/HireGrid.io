# API Reference — HireGrid.io

Specification for the REST endpoints and Server-Sent Events (SSE) stream exposed
by the HireGrid.io FastAPI backend (`http://localhost:8000` in local
development).

Interactive OpenAPI docs are generated automatically at
`http://localhost:8000/docs`. When this file and the generated schema disagree,
the generated schema is authoritative.

---

## 🔐 Authentication Header

Protected endpoints require the session token in the HTTP `Authorization` header:

```http
Authorization: Bearer <SESSION_TOKEN>
```

A missing, malformed, or expired token returns `401 Unauthorized`.

### Authorization model

Every resource is scoped to the authenticated user's email address. A caller who
requests a screening or candidate belonging to someone else receives
**`404 Not Found`**, not `403` — the API does not disclose whether the id exists.

---

## 🔑 Authentication Endpoints

### 1. User Signup
- **Endpoint**: `POST /api/auth/signup`
- **Auth Required**: No
- **Request Body** (`application/json`):
  ```json
  {
    "email": "recruiter@company.com",
    "password": "SecurePassword123",
    "name": "Jane Doe",
    "role": "Recruitment Lead"
  }
  ```
- **Supported Roles**: `Recruitment Lead`, `Recruitment Director`,
  `Technical Recruiter`, `HR Manager`, `Recruiter`. An unrecognised role is
  silently coerced to `Recruitment Lead` to prevent privilege escalation.
- **Validation**: email must contain `@`; password must be at least 4 characters.
- **Response** (`201 Created`):
  ```json
  {
    "email": "recruiter@company.com",
    "name": "Jane Doe",
    "role": "Recruitment Lead",
    "token": "eyJlbWFpbCI6..."
  }
  ```
- **Errors**: `400` invalid email, short password, or email already registered.

---

### 2. User Login
- **Endpoint**: `POST /api/auth/login`
- **Auth Required**: No
- **Request Body** (`application/json`):
  ```json
  {
    "email": "recruiter@company.com",
    "password": "SecurePassword123"
  }
  ```
- **Response** (`200 OK`): same shape as signup.
- **Errors**:
  - `401` — invalid credentials (identical message whether the account exists or
    the password is wrong).
  - `429` — rate limited. Throttling is keyed on client IP + email, defaulting to
    10 attempts per 300 seconds (`LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`).
    The response carries a `Retry-After` header. A successful login clears the
    counter.

---

### 3. Google OAuth Login
- **Endpoint**: `POST /api/auth/google`
- **Auth Required**: No
- **Request Body** (`application/json`):
  ```json
  {
    "credential": "<GOOGLE_ID_TOKEN>"
  }
  ```
- **Behaviour**: the token is verified server-side against
  `https://oauth2.googleapis.com/tokeninfo`. The account must have
  `email_verified: true`. Unknown emails are auto-provisioned with role
  `Recruitment Lead` and an unusable random password.
- **Response** (`200 OK`): same shape as signup.
- **Errors**: `400` missing credential, failed verification, or unverified email.

> **Development bypass.** When `ENV` is not `production` *and*
> `ALLOW_DEV_BYPASS=true`, credentials beginning `mock_google_jwt_` are accepted
> without verification. This is a complete authentication bypass and is disabled
> unconditionally when `ENV=production`, regardless of `ALLOW_DEV_BYPASS`.

---

## 📋 Screening Endpoints

### 4. List Screening Runs
- **Endpoint**: `GET /api/screenings`
- **Auth Required**: Yes
- **Returns**: every screening owned by the caller, newest first, each with its
  full candidate list.
- **Response** (`200 OK`):
  ```json
  [
    {
      "id": "screening-9a8b7c6d...",
      "job_title": "Senior Python Backend Engineer",
      "job_description": "We are seeking a Python developer...",
      "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
      "date": "2026-07-29 10:15:30",
      "total_candidates": 12,
      "candidates": []
    }
  ]
  ```

---

### 5. Get Screening Details
- **Endpoint**: `GET /api/screenings/{screening_id}`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  {
    "id": "screening-9a8b7c6d...",
    "job_title": "Senior Python Backend Engineer",
    "job_description": "We are seeking a Python developer...",
    "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
    "date": "2026-07-29 10:15:30",
    "total_candidates": 2,
    "candidates": [
      {
        "candidate_id": "cand-101ab...",
        "candidate_name": "Alex Smith",
        "candidate_filename": "alex_smith_resume.pdf",
        "file_path": "/app/backend/uploads/cand-101ab....pdf",
        "score": 88.5,
        "score_breakdown": {
          "skills": 90.0,
          "semantic_similarity": 85.2,
          "experience": 100.0,
          "education": 100.0,
          "certifications": 50.0,
          "location": 100.0,
          "language": 100.0
        },
        "matched_skills": ["Python", "FastAPI", "Docker"],
        "missing_skills": ["PostgreSQL"],
        "extracted_info": {
          "experience_years": 5.5,
          "education": "Bachelor",
          "location": "New York",
          "certifications": ["Aws Certified"],
          "languages": ["English"],
          "projects_count": 3,
          "past_titles": ["Senior Software Engineer"],
          "email": "alex@example.com",
          "phone": "+1 555-4321"
        },
        "summary": "Alex Smith shows strong overall fit. Matches 3 required skill(s): Python, FastAPI, Docker...",
        "status": "Shortlisted",
        "notes": "Strong candidate for round 2."
      }
    ]
  }
  ```
- **Note**: component scores are nested under `score_breakdown`, and parsed
  resume attributes under `extracted_info` — they are not flat top-level fields.
- **Errors**: `404` if the screening does not exist **or** belongs to another user.

---

### 6. Delete Screening Run
- **Endpoint**: `DELETE /api/screenings/{screening_id}`
- **Auth Required**: Yes
- **Behaviour**: deletes the screening and all of its candidates in a single
  transaction, then removes the stored PDF files from disk.
- **Response** (`200 OK`):
  ```json
  { "message": "Screening deleted successfully" }
  ```
- **Errors**: `404` not found or not owned by the caller.

---

### 7. Screening Report Summary
- **Endpoint**: `GET /api/screenings/{screening_id}/report`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  {
    "title": "Senior Python Backend Engineer",
    "screening_id": "screening-9a8b7c6d...",
    "created_at": null,
    "total_candidates": 12,
    "metrics": {
      "average_score": 71.4,
      "max_score": 94.2,
      "shortlist_yield_percent": 25.0
    },
    "required_skills": ["Python", "FastAPI"],
    "top_candidates": [
      {
        "name": "Alex Smith",
        "score": 94.2,
        "yoe": 5.5,
        "matched_skills": ["Python", "FastAPI"],
        "summary": "Alex Smith shows strong overall fit..."
      }
    ]
  }
  ```
- `shortlist_yield_percent` counts candidates scoring ≥ 80.

---

## 🧪 Analysis Endpoints

Two endpoints run the same scoring pipeline. `/api/analyze` is stateless;
`/api/analyze/stream` persists results and streams progress.

### 8. Batch Analysis (stateless)
- **Endpoint**: `POST /api/analyze`
- **Auth Required**: Yes
- **Content Type**: `multipart/form-data`

| Field | Type | Default | Notes |
|---|---|---|---|
| `job_title` | string | *required* | |
| `job_description` | string | *required* | Drives semantic matching |
| `required_skills` | string | *required* | Comma-separated. A `!` suffix marks a must-have (double weight; missing it caps the skills score), `?` marks nice-to-have (half weight). Markers are stripped before storage and display. |
| `top_n_candidates` | integer | `10` | Caps the ranked list |
| `required_experience_years` | integer | `0` | |
| `required_education` | string | `"Any"` | `Any`/`High School`/`Bachelor`/`Master`/`PhD` |
| `preferred_location` | string | `""` | |
| `preferred_languages` | string | `""` | Comma-separated |
| `required_certifications` | string | `""` | Comma-separated |
| `resumes` | file[] | *required* | PDF uploads (field name is `resumes`) |

- **Response** (`200 OK`):
  ```json
  {
    "job_title": "Senior Python Backend Engineer",
    "total_candidates": 5,
    "ranked_candidates": [],
    "rejected_candidates": [],
    "total_ranked": 4,
    "total_rejected": 1
  }
  ```
- Candidates below the relevance floor are returned in `rejected_candidates`
  with `score: 0.0` and an `audit_log` explaining the rejection. They are
  reported rather than discarded so filtering decisions remain auditable.
- Per-file failures do not fail the request; the file appears in
  `rejected_candidates` with the error in its `summary`.
- Uploads are capped at `MAX_RESUME_BYTES` (default 15MB) per file.

---

### 9. Streaming Analysis (persists results)
- **Endpoint**: `POST /api/analyze/stream`
- **Auth Required**: Yes
- **Content Type**: `multipart/form-data` (same fields as endpoint 8)
- **Response**: `text/event-stream`

Every message is a `data:` line containing a JSON object with a `type` field.

- **`status`** — emitted once at the start:
  ```json
  { "type": "status", "message": "Starting analysis of 5 resume(s)..." }
  ```
- **`progress`** — emitted repeatedly. `step` and `total` are present only on
  the per-file message that begins each candidate:
  ```json
  { "type": "progress", "message": "[1/5] Parsing layout of alex.pdf...", "step": 1, "total": 5 }
  ```
- **`result`** — emitted once at the end. `data` is the full screening object as
  returned by endpoint 5, re-read from the database:
  ```json
  { "type": "result", "data": { "id": "screening-...", "candidates": [] } }
  ```

Consumers should switch on `type` and ignore unknown values.

**Persistence.** Only the top `top_n_candidates` ranked candidates are stored;
PDFs for candidates beyond the cutoff are deleted. Auto-rejected candidates are
stored with `status: "Auto-Rejected"` so the rejection remains on record.

---

## 👤 Candidate Endpoints

### 10. Update Pipeline Status
- **Endpoint**: `PATCH /api/candidates/{cand_id}/status`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  { "status": "Interview" }
  ```
- **Allowed Statuses**: `Applied`, `Screening`, `Shortlisted`, `Interview`,
  `Offer`, `Hired`, `Rejected`, `Auto-Rejected`.
- **Response** (`200 OK`):
  ```json
  { "message": "Status updated successfully", "status": "Interview" }
  ```
- **Errors**: `400` status not in the allowed set; `404` candidate not found or
  not owned by the caller.

---

### 11. Update Recruiter Notes
- **Endpoint**: `PATCH /api/candidates/{cand_id}/notes`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  { "notes": "Passed technical phone screening with 9/10." }
  ```
- **Response** (`200 OK`):
  ```json
  { "message": "Notes updated successfully", "notes": "Passed technical phone screening with 9/10." }
  ```
- **Errors**: `404` candidate not found or not owned by the caller.

---

### 12. Download Candidate Resume
- **Endpoint**: `GET /api/candidates/{cand_id}/cv`
- **Auth Required**: Yes
- **Response**: `application/pdf`, named after the original upload.
- **Security**: the stored path is resolved and confirmed to sit inside the
  uploads directory before the file is served, so a tampered database row cannot
  be used to read arbitrary files.
- **Errors**: `404` candidate not owned by the caller, or file missing on disk.

---

## 📊 Analytics

### 13. Account Analytics
- **Endpoint**: `GET /api/analytics`
- **Auth Required**: Yes
- **Scope**: aggregates only over screenings owned by the caller.
- **Response** (`200 OK`):
  ```json
  {
    "total_screenings": 15,
    "total_candidates": 142,
    "scored_candidates": 118,
    "average_score": 74.2,
    "max_score": 96.5,
    "shortlisted_candidates": 38,
    "shortlist_yield_percent": 32.2
  }
  ```
- `total_candidates` includes auto-rejected records; `scored_candidates` counts
  only those with a score above zero. Averages are computed over the latter.

---

## 🩺 Service

### 14. Health / Version
- **Endpoint**: `GET /`
- **Auth Required**: No
- **Response** (`200 OK`):
  ```json
  { "message": "HireGrid.io API is running", "version": "2.0.0" }
  ```

---

## Status Code Summary

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Account created |
| `400` | Invalid input, duplicate email, or failed Google verification |
| `401` | Missing, malformed, or expired token; bad credentials |
| `404` | Resource does not exist **or** is owned by another user |
| `429` | Login rate limit exceeded (see `Retry-After`) |
| `500` | Unhandled server error |
