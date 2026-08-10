# System Architecture — HireGrid.io

This document describes the high-level system architecture, client-server topology, data processing workflows, and component interactions of **HireGrid.io**.

---

## 🏛️ High-Level Topology

HireGrid.io is structured as a decoupled full-stack architecture featuring a **Next.js 16 / React 19 SPA frontend** and a **FastAPI (Python 3.11) microservice backend**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                   Next.js 16 (App Router) + React 19                      │  │
│  │                                                                           │  │
│  │  ┌───────────────┐   ┌────────────────┐   ┌───────────────────────────┐   │  │
│  │  │  Auth Context │   │ Screening Form │   │ SSE Stream Listener       │   │  │
│  │  └───────┬───────┘   └───────┬────────┘   └─────────────┬─────────────┘   │  │
│  └──────────┼───────────────────┼──────────────────────────┼─────────────────┘  │
└─────────────┼───────────────────┼──────────────────────────┼────────────────────┘
              │ Bearer Auth       │ Multipart POST           │ EventSource (GET)
              ▼                   ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 SERVER LAYER                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           FastAPI Web Server                              │  │
│  │                                                                           │  │
│  │  ┌───────────────┐   ┌────────────────┐   ┌───────────────────────────┐   │  │
│  │  │ Auth Handler  │   │ Screening API  │   │ SSE Streaming Engine      │   │  │
│  │  └───────┬───────┘   └───────┬────────┘   └─────────────┬─────────────┘   │  │
│  └──────────┼───────────────────┼──────────────────────────┼─────────────────┘  │
│             │                   │                          │                    │
│             ▼                   ▼                          ▼                    │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                      CORE ENGINE & NLP PIPELINE                          │  │
│   │                                                                          │  │
│   │  ┌───────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │  │
│   │  │ PDF Parser    │  │ Rule-Based      │  │ Sentence-Transformers      │  │  │
│   │  │ (pdfplumber)  │  │ Extraction      │  │ (configurable model)       │  │  │
│   │  └───────┬───────┘  └────────┬────────┘  └─────────────┬──────────────┘  │  │
│   │          │                   │                         │                 │  │
│   │          └───────────────────┴────────────┬────────────┘                 │  │
│   │                                           ▼                              │  │
│   │                            ┌────────────────────────────┐                │  │
│   │                            │ Rules Engine v3            │                │  │
│   │                            │ (Composite Fit & Soft Veto)│                │  │
│   │                            └──────────────┬─────────────┘                │  │
│   └───────────────────────────────────────────┼──────────────────────────────┘  │
│                                               ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     DATA ACCESS LAYER (core/db.py)                        │  │
│  │        Dual Storage Support: SQLite (Default) / PostgreSQL                │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Architecture (`/frontend`)

The frontend application is built with modern web technologies focused on rendering performance and visual excellence:

- **Framework**: Next.js 16 (App Router) with React 19.
- **Styling**: Tailwind CSS with responsive layout grids, glassmorphism visual styling, dark mode, and dynamic state colors.
- **State Management**: React `AuthContext` managing persistent session tokens, local storage sync, and user profile state.
- **Interactive Components**:
  - **NewScreeningForm**: Handles job requirements definition and multi-CV drag-and-drop file staging.
  - **Live Progress Feed**: Server-Sent Events (SSE) stream listener displaying candidate parsing progress step-by-step.
  - **CandidateDrawer**: Detailed candidate breakdown showing component score radar/bar distributions, matched/missing skill chips, and notes editing.
  - **CandidateComparisonModal**: Side-by-side comparative analysis of shortlisted candidates.
  - **DeepAnalysis**: Visual charts and pipeline yield metrics for recruiters.

---

## ⚙️ Backend Architecture (`/backend`)

The backend microservice is designed for throughput and async CPU task execution:

- **Framework**: FastAPI (ASGI server powered by Uvicorn).
- **Concurrency Model**: CPU-intensive operations (PDF text extraction, regex parsing, transformer vector encoding) are dispatched off the ASGI event loop with `fastapi.concurrency.run_in_threadpool`, so REST and SSE responses never block.
- **Modules**:
  - `core/parser.py`: PDF text extraction via `pdfplumber`, with whitespace normalisation.
  - `core/nlp_layer.py`: Rule-based attribute extraction — skills, experience, education, location, certifications, contact details. Regex and phrase matching throughout; no NER model on the request path.
  - `core/skill_aliases.py`: Skill vocabulary normalisation (`k8s` → `kubernetes`). Consulted by extraction, scoring, and similarity so all three agree on what counts as the same skill.
  - `core/skill_weights.py`: Parses must-have (`!`) and nice-to-have (`?`) markers off required skills, and reports which non-negotiables a candidate is missing.
  - `core/similarity.py`: Sentence-transformer embeddings with a model registry (per-model calibration bands and query prefixes), section-chunk scoring, and batch encoding.
  - `core/rules_engine.py`: Weighted composite scoring, soft-veto guardrail, seniority and experience penalties, per-component audit log.
  - `core/auth.py`: PBKDF2-HMAC-SHA256 password hashing and HMAC-signed session tokens.
  - `core/db.py`: SQL abstraction over SQLite and PostgreSQL — connection pooling, scoped transactions, and ownership-enforcing queries.

### Shared scoring path

Both `/api/analyze` and `/api/analyze/stream` delegate to a single
`_score_one_candidate()` helper. The two endpoints previously carried duplicate
copies of the pipeline, which let their behaviour drift apart; consolidating
means a scoring change cannot apply to one endpoint and not the other.

### Data access

- **Connection pooling**: PostgreSQL uses a `ThreadedConnectionPool`
  (`DB_POOL_MAX`, default 10). Opening a connection per query exhausts the
  server's connection limit under load.
- **Scoped transactions**: the `db_session()` context manager commits once on
  success, rolls back on any exception, and always returns the connection.
- **Atomic deletes**: a screening and its candidates are removed in one
  transaction, children first. SQLite additionally enables
  `PRAGMA foreign_keys = ON`, without which its declared cascades never fire.
- **List serialisation**: skill lists are stored as JSON rather than
  comma-joined strings, which corrupted any skill containing a comma. The reader
  still accepts the legacy comma format for existing rows.

---

## 🔑 Authentication & Authorization Flow

### Authentication (who you are)

1. **Email / password**
   - Salt: 32 random bytes via `os.urandom(32)`.
   - Derivation: `hashlib.pbkdf2_hmac('sha256', password, salt, 100_000)`.
   - Verification uses `hmac.compare_digest` to avoid timing leaks.
2. **Google OAuth 2.0**
   - ID tokens verified server-side against
     `https://oauth2.googleapis.com/tokeninfo`; `email_verified` must be true.
   - Unknown emails are auto-provisioned with an unusable random password.
3. **Session tokens**
   - Format: `base64url(payload).base64url(HMAC-SHA256(payload))` carrying
     `email`, `role`, and `exp` (24 hours).
   - Signature is checked before the payload is decoded.
   - The signing key has **no default** — see the security section below.

### Authorization (what you may touch)

Authentication alone is not sufficient: every resource is additionally scoped to
its owner.

- Screening reads and deletes filter on `user_email`.
- Candidate operations resolve ownership by joining
  `candidates → screenings → user_email`. `db_get_candidate_owned()` is the only
  sanctioned candidate lookup; status and notes updates enforce ownership inside
  the `UPDATE` statement itself, so a non-matching row simply updates nothing.
- A resource owned by someone else returns **`404`**, not `403` — the API does
  not confirm that an id exists.

> This is enforced by regression tests in `backend/tests/test_authorization.py`.
> An earlier revision authenticated the caller but never checked ownership, so
> any logged-in user could read or mutate any candidate by id.

### Session model limitations

Tokens are stateless and self-contained. There is no server-side revocation and
no refresh flow — logout is client-side only, and a leaked token stays valid
until it expires. Rotating `JWT_SECRET` invalidates all sessions at once.

---

## 📡 Real-Time SSE Streaming Architecture

Batch parsing takes roughly 1–3 seconds per document, so `POST /api/analyze/stream`
returns a `text/event-stream` and reports progress as it works.

```
Client (Next.js)                        Backend (FastAPI)
  │                                          │
  ├─────── POST /api/analyze/stream ────────►│ multipart/form-data
  │                                          │ 0. Spool every upload to disk
  │◄────── 200 OK (text/event-stream) ───────┤    (chunked, size-capped)
  │                                          │
  │◄────── {"type":"status"} ────────────────┤ 1. Announce batch size
  │                                          │
  │◄────── {"type":"progress", step, total} ─┤ 2. Per candidate:
  │◄────── {"type":"progress"} ──────────────┤    - extract PDF text
  │                                          │    - rule-based extraction
  │                                          │    - embeddings + scoring
  │                                          │    - keep or auto-reject
  │                                          │
  │                                          │ 3. Rank, apply top_n cutoff,
  │                                          │    persist screening +
  │                                          │    candidates in one pass
  │◄────── {"type":"result", data} ──────────┤ 4. Emit the stored screening
```

Uploads are **spooled to disk before the generator runs**, for two reasons: the
request body is only readable inside the handler, and buffering an entire batch
in memory (100 CVs × 5MB) would exhaust RAM before any work began.

All three message types arrive on the same `data:` channel and are distinguished
by their `type` field — see the [API Reference](api-reference.md).

---

## 🔐 Security & Data Protection

- **Secret management**: `JWT_SECRET` has no shipped default. With
  `ENV=production` a missing value raises at startup; elsewhere a random
  per-process key is generated and warned about. The admin seed refuses the
  example password in production.
- **Object-level authorization**: enforced per resource, not just per session —
  see the authorization section above.
- **CORS**: origins restricted to `ALLOWED_ORIGINS`. A wildcard is rejected,
  since Starlette cannot combine `*` with credentialed requests.
- **Role validation**: signup roles are checked against an allow-list; anything
  unrecognised is coerced to `Recruitment Lead`.
- **Login throttling**: fixed-window counter per IP + email, returning `429` with
  `Retry-After`. In-process only — front it with a gateway limiter when running
  multiple workers.
- **Upload handling**: files are streamed to disk in 1MB chunks and capped at
  `MAX_RESUME_BYTES`. Stored names are server-generated UUIDs
  (`uploads/cand-<uuid>.pdf`); the original filename is never used as a path.
- **Path confinement**: CV downloads resolve the stored path with `realpath` and
  confirm it sits inside the uploads directory, so a tampered database row cannot
  be used to read arbitrary files.
- **Status validation**: pipeline statuses are checked against an allow-list
  before reaching the database.

### Handling candidate data

Resume PDFs are personal data. Two operational consequences:

- `backend/uploads/` is gitignored — never commit real CVs. If any were
  committed historically, purging the working tree does not remove them from git
  history; that requires a history rewrite.
- Deleting a screening removes its candidate rows **and** their PDFs from disk.
  Candidates dropped by the `top_n_candidates` cutoff have their files deleted
  rather than left orphaned.
