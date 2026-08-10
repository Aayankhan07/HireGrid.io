# Database Schema & Data Access Layer — HireGrid.io

This document outlines the database design, entity models, table schemas, and dual SQLite/PostgreSQL storage layer implementation in **HireGrid.io**.

---

## 🗄️ Database Architecture (`core/db.py`)

HireGrid.io features a unified database access layer that automatically adapts query execution based on the environment configuration (`DATABASE_URL`):

- **Default Engine**: SQLite at `backend/hiregrid.db` (resolved as an absolute
  path, so the database does not follow the working directory).
- **Production Engine**: PostgreSQL when `DATABASE_URL` is set.

The layer switches between `sqlite3` and `psycopg2`, handling parameter binding
(`?` vs `%s`) and row formatting (`sqlite3.Row` vs `RealDictCursor`). `psycopg2`
is imported only on the Postgres path, so it is not a hard dependency for local
SQLite development.

### Connection handling

| Engine | Strategy |
|---|---|
| PostgreSQL | `ThreadedConnectionPool`, size `DB_POOL_MAX` (default 10) |
| SQLite | New connection per session, with `PRAGMA foreign_keys = ON` |

Use the `db_session()` context manager rather than raw connections:

```python
with db_session(commit=True) as conn:
    cursor = execute_query(conn, "UPDATE ...", params)
    cursor.close()
```

It commits once on clean exit, **rolls back on any exception**, and always
returns the connection to the pool. The previous per-call
`get_db_connection()` / `conn.close()` pattern had no rollback, so a failed write
could leave a partial transaction on Postgres, and opened a fresh connection for
every query.

### Ownership-scoped queries

Candidate access must go through ownership-aware helpers. There is deliberately
no "fetch candidate by id" function:

| Function | Guarantee |
|---|---|
| `db_get_candidate_owned(cand_id, email)` | Joins to `screenings` and returns `None` unless the caller owns it |
| `db_update_candidate_status(cand_id, status, email)` | Ownership is part of the `WHERE` clause; returns `False` when nothing matched |
| `db_update_candidate_notes(cand_id, notes, email)` | Same |
| `db_get_analytics(email)` | Aggregates only over the caller's screenings |

Enforcing ownership inside the statement — rather than in a separate check —
means there is no window between the check and the write.

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
| `password_salt` | `TEXT` | `NOT NULL` | 32-byte random salt, hex-encoded |
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
| `status` | `TEXT` | `DEFAULT 'Applied'` | `Applied`, `Screening`, `Shortlisted`, `Interview`, `Offer`, `Hired`, `Rejected`, `Auto-Rejected` |
| `notes` | `TEXT` | `DEFAULT ''` | Recruiter comments & evaluation feedback |

---

## 🔄 Deletion, Cascades & Serialization

### Deletion is explicit, not cascade-dependent

`ON DELETE CASCADE` is declared on `user_email` and `screening_id`, but the
application does **not** rely on it. SQLite ignores foreign-key constraints
unless `PRAGMA foreign_keys = ON` is set per connection (the layer now sets it,
but any older connection or external tool will not).

`db_delete_screening()` therefore deletes explicitly and atomically:

```
BEGIN
  SELECT id FROM screenings WHERE id = ? AND user_email = ?   -- ownership check
  DELETE FROM candidates WHERE screening_id = ?               -- children first
  DELETE FROM screenings WHERE id = ?                         -- then parent
COMMIT
```

Both statements share one transaction. The earlier implementation committed each
separately, so a crash between them left orphaned candidate rows.

The API layer additionally removes the candidates' PDF files from disk before
the rows are deleted.

### List serialization

`required_skills`, `matched_skills`, and `missing_skills` are stored as JSON
arrays. They were previously comma-joined strings, which corrupted any skill
containing a comma (`"C++, STL"` split into two bogus skills). The reader accepts
both formats, so existing rows continue to work:

```python
_serialize_skills(["Python", "C++, STL"])   # '["Python", "C++, STL"]'
_deserialize_skills('["Python"]')           # ["Python"]  — JSON
_deserialize_skills("Python,FastAPI")       # ["Python", "FastAPI"]  — legacy
```

### Auto-rejected candidates

Candidates below the relevance floor are stored with `status = 'Auto-Rejected'`
and `score = 0.0` rather than being discarded, so screening decisions stay
auditable. Queries that report on ranked candidates should filter on
`score > 0` or exclude that status explicitly.

### Schema migrations

`init_db()` is idempotent: it issues `CREATE TABLE IF NOT EXISTS` and attempts
`ALTER TABLE ... ADD COLUMN` for later-added score columns, ignoring the error
when a column already exists. There is no migration-version table — for larger
schema changes, adopt a real migration tool rather than extending this pattern.
