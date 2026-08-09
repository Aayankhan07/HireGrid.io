# API Reference — HireGrid.io

This document provides a detailed specification for the RESTful endpoints and Server-Sent Events (SSE) streams exposed by the HireGrid.io FastAPI backend (`http://localhost:8000`).

---

## 🔐 Authentication Header

For all protected endpoints, client requests must pass the JWT session token in the HTTP `Authorization` header:

```http
Authorization: Bearer <SESSION_TOKEN>
```

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
- **Supported Roles**: `Recruitment Lead`, `Recruitment Director`, `Technical Recruiter`, `HR Manager`, `Recruiter`.
- **Response** (`201 Created`):
  ```json
  {
    "email": "recruiter@company.com",
    "name": "Jane Doe",
    "role": "Recruitment Lead",
    "token": "eyJhbGciOi..."
  }
  ```

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
- **Response** (`200 OK`):
  ```json
  {
    "email": "recruiter@company.com",
    "name": "Jane Doe",
    "role": "Recruitment Lead",
    "token": "eyJhbGciOi..."
  }
  ```

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
- **Response** (`200 OK`):
  ```json
  {
    "email": "jane.google@company.com",
    "name": "Jane Google",
    "role": "Recruitment Lead",
    "token": "eyJhbGciOi..."
  }
  ```

---

## 📋 Screening Endpoints

### 4. List User Screening Runs
- **Endpoint**: `GET /api/screenings`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  [
    {
      "id": "scr_9a8b7c6d",
      "job_title": "Senior Python Backend Engineer",
      "candidate_count": 12,
      "created_at": "2026-07-29T10:15:30Z"
    }
  ]
  ```

---

### 5. Get Screening Run Details & Candidates
- **Endpoint**: `GET /api/screenings/{screening_id}`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  {
    "id": "scr_9a8b7c6d",
    "job_title": "Senior Python Backend Engineer",
    "job_description": "We are seeking a Python developer with FastAPI and spaCy experience...",
    "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
    "created_at": "2026-07-29T10:15:30Z",
    "candidates": [
      {
        "id": "cand_101",
        "candidate_name": "Alex Smith",
        "candidate_filename": "alex_smith_resume.pdf",
        "score": 88.5,
        "skills_score": 90.0,
        "semantic_score": 85.2,
        "experience_score": 100.0,
        "education_score": 100.0,
        "certifications_score": 50.0,
        "location_score": 100.0,
        "language_score": 100.0,
        "yoe": 5.5,
        "location": "New York, USA",
        "matched_skills": ["Python", "FastAPI", "Docker"],
        "missing_skills": ["PostgreSQL"],
        "summary": "Alex Smith shows strong overall fit...",
        "status": "Shortlisted",
        "notes": "Strong candidate for round 2."
      }
    ]
  }
  ```

---

### 6. Delete Screening Run
- **Endpoint**: `DELETE /api/screenings/{screening_id}`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  {
    "message": "Screening deleted successfully"
  }
  ```

---

### 7. Real-Time Streaming Screening Run (SSE)
- **Endpoint**: `POST /api/screenings/stream`
- **Auth Required**: Yes (`Authorization: Bearer <TOKEN>`)
- **Content Type**: `multipart/form-data`
- **Form Fields**:
  - `job_title`: string (Required)
  - `job_description`: string (Optional)
  - `required_skills`: string or JSON array (e.g. `["Python", "React"]`)
  - `required_experience_years`: integer (Default: `0`)
  - `required_education`: string (Default: `"Any"`)
  - `preferred_location`: string (Optional)
  - `files`: PDF document binary stream(s)
- **Response**: `text/event-stream`
- **SSE Event Messages**:
  - **`progress`**:
    ```json
    { "type": "progress", "message": "Parsing candidate resume 1 of 5...", "percentage": 20 }
    ```
  - **`candidate_done`**:
    ```json
    { "type": "candidate_done", "candidate": { "id": "cand_101", "name": "Alex Smith", "score": 88.5 } }
    ```
  - **`complete`**:
    ```json
    { "type": "complete", "screening_id": "scr_9a8b7c6d", "candidate_count": 5 }
    ```

---

## 👤 Candidate Management Endpoints

### 8. Update Candidate Pipeline Status
- **Endpoint**: `PUT /api/candidates/{candidate_id}/status`
- **Auth Required**: Yes
- **Request Body** (`application/json`):
  ```json
  {
    "status": "Interviewing"
  }
  ```
- **Allowed Statuses**: `Applied`, `Shortlisted`, `Interviewing`, `Rejected`, `Hired`.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "status": "Interviewing"
  }
  ```

---

### 9. Update Candidate Recruiter Notes
- **Endpoint**: `PUT /api/candidates/{candidate_id}/notes`
- **Auth Required**: Yes
- **Request Body** (`application/json`):
  ```json
  {
    "notes": "Passed technical phone screening with 9/10."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "notes": "Passed technical phone screening with 9/10."
  }
  ```

---

### 10. Download Candidate Resume PDF
- **Endpoint**: `GET /api/candidates/{candidate_id}/cv`
- **Auth Required**: Yes
- **Response**: Binary PDF file (`application/pdf`) with `Content-Disposition: attachment`.

---

## 📊 Analytics Endpoint

### 11. Dashboard Overview Analytics
- **Endpoint**: `GET /api/analytics`
- **Auth Required**: Yes
- **Response** (`200 OK`):
  ```json
  {
    "total_screenings": 15,
    "total_candidates": 142,
    "shortlisted_count": 38,
    "average_fit_score": 74.2,
    "skill_distribution": [
      { "skill": "Python", "count": 89 },
      { "skill": "React", "count": 64 }
    ],
    "pipeline_breakdown": {
      "Applied": 60,
      "Shortlisted": 38,
      "Interviewing": 24,
      "Hired": 12,
      "Rejected": 8
    }
  }
  ```
