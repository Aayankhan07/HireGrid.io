# Database Schema & Data Access Layer — HireGrid.io

This document outlines the database design, entity models, table schemas, and dual SQLite/PostgreSQL storage layer implementation in **HireGrid.io**.

---

## 🗄️ Database Architecture (`core/db.py`)

HireGrid.io features a unified database access layer that automatically adapts query execution based on the environment configuration (`DATABASE_URL`):

- **Default Engine**: Local SQLite database stored at `/backend/hiregrid.db`.
- **Production Engine**: PostgreSQL (e.g. AWS RDS, Supabase, Neon) when `DATABASE_URL` is set (e.g. `postgresql://user:pass@host:5432/dbname`).

The abstraction layer seamlessly switches between `sqlite3` and `psycopg2`, handling dynamic parameter binding (`?` vs `%s`) and row formatting (`sqlite3.Row` vs `RealDictCursor`).

---

## 📐 Entity Relationship Diagram

```
┌─────────────────────────┐
│          users          │
├─────────────────────────┤
│ id (PK)                 │
│ email (UQ) ─────────────┼────────┐
│ name                    │        │
│ password_hash           │        │
│ password_salt           │        │
│ role                    │        │
│ created_at              │        │
└─────────────────────────┘        │
                                   │ 1:N
                                   ▼
                        ┌─────────────────────────┐
                        │       screenings        │
                        ├─────────────────────────┤
                        │ id (PK) ────────────────┼────────┐
                        │ user_email (FK)         │        │
                        │ job_title               │        │
                        │ job_description         │        │
                        │ required_skills (JSON)  │        │
                        │ created_at              │        │
                        └─────────────────────────┘        │
                                                           │ 1:N
                                                           ▼
                                                ┌─────────────────────────┐
                                                │       candidates        │
                                                ├─────────────────────────┤
                                                │ id (PK)                 │
                                                │ screening_id (FK)       │
                                                │ candidate_name          │
                                                │ candidate_filename      │
                                                │ file_path               │
                                                │ score                   │
                                                │ skills_score            │
                                                │ semantic_score          │
                                                │ experience_score        │
                                                │ education_score         │
                                                │ certifications_score    │
                                                │ location_score          │
                                                │ language_score          │
                                                │ yoe                     │
                                                │ location                │
                                                │ matched_skills (JSON)   │
                                                │ missing_skills (JSON)   │
                                                │ summary                 │
                                                │ status                  │
                                                │ notes                   │
                                                └─────────────────────────┘
```

---

## 📋 Table Definitions

### 1. `users` Table
Stores registered recruiter accounts and hashed authentication credentials.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` / `SERIAL` | `PRIMARY KEY` | Auto-incrementing primary identifier |
| `email` | `TEXT` | `UNIQUE NOT NULL` | User email address (lowercased) |
| `name` | `TEXT` | `NOT NULL` | Recruiter full name |
| `password_hash` | `TEXT` | `NOT NULL` | PBKDF2 HMAC SHA256 password hash hex string |
| `password_salt` | `TEXT` | `NOT NULL` | 16-byte random salt hex string |
| `role` | `TEXT` | `NOT NULL` | Organizational role (e.g. `Recruitment Lead`) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |

---

### 2. `screenings` Table
Stores metadata for candidate evaluation runs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique screening identifier (e.g., `scr_a1b2c3d4`) |
| `user_email` | `TEXT` | `NOT NULL, FK -> users(email)` | Owner user email |
| `job_title` | `TEXT` | `NOT NULL` | Target job position title |
| `job_description` | `TEXT` | | Detailed job requirements text |
| `required_skills` | `TEXT` | | JSON stringified list of required skills |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Run creation timestamp |

---

### 3. `candidates` Table
Stores parsed resume data, component fit scores, status pipeline, and recruiter notes for every processed candidate.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Unique candidate identifier |
| `screening_id` | `TEXT` | `NOT NULL, FK -> screenings(id)` | Parent screening run ID |
| `candidate_name` | `TEXT` | `NOT NULL` | Extracted or fallback candidate name |
| `candidate_filename` | `TEXT` | `NOT NULL` | Original uploaded PDF filename |
| `file_path` | `TEXT` | `NOT NULL` | Server filesystem path to stored PDF file |
| `score` | `REAL` | `NOT NULL` | Overall composite fit score (0.0 – 100.0) |
| `skills_score` | `REAL` | | Blended skills match score |
| `semantic_score` | `REAL` | | Sentence-Transformers vector similarity score |
| `experience_score` | `REAL` | | Experience duration fit score |
| `education_score` | `REAL` | | Education level fit score |
| `certifications_score`| `REAL` | | Certification match score |
| `location_score` | `REAL` | | Location match score |
| `language_score` | `REAL` | | Language match score |
| `yoe` | `REAL` | | Extracted years of experience |
| `location` | `TEXT` | | Extracted candidate location |
| `matched_skills` | `TEXT` | | JSON stringified list of matched skills |
| `missing_skills` | `TEXT` | | JSON stringified list of missing skills |
| `summary` | `TEXT` | | Executive summary generated by rules engine |
| `status` | `TEXT` | `DEFAULT 'Applied'` | Pipeline status (`Applied`, `Shortlisted`, `Interviewing`, `Rejected`, `Hired`) |
| `notes` | `TEXT` | `DEFAULT ''` | Recruiter comments & evaluation feedback |

---

## 🔄 Cascade Rules & Maintenance
- **Foreign Keys**: `ON DELETE CASCADE` is enforced on `user_email` and `screening_id`. Deleting a user or screening run automatically purges all child candidates.
- **JSON Serialization**: List fields (`required_skills`, `matched_skills`, `missing_skills`) are stored as serialized JSON strings for transparent multi-engine compatibility.
