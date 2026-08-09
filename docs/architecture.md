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
│   │  │ PDF Parser    │  │ spaCy NLP Layer │  │ Sentence-Transformers      │  │  │
│   │  │ (pdfplumber)  │  │ (Entity & Skill)│  │ (all-MiniLM-L6-v2)         │  │  │
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
- **Concurrency Model**: CPU-intensive operations (PDF rendering, spaCy NLP tokenization, transformer vector encoding) are dispatched off the ASGI event loop using `fastapi.concurrency.run_in_threadpool` or `asyncio.to_thread` to maintain zero-blocking REST and SSE responses.
- **Modules**:
  - `core/parser.py`: PDF text extraction wrapping `pdfplumber` with fallback string cleanups.
  - `core/nlp_layer.py`: Natural Language Processing pipeline leveraging spaCy (`en_core_web_sm`) and comprehensive skill/certification phrase matching.
  - `core/similarity.py`: Vector embeddings generator using PyTorch & HuggingFace `sentence-transformers/all-MiniLM-L6-v2`.
  - `core/rules_engine.py`: Multi-criteria composite decision system calculating weighted fit scores, experience non-linear calibrations, and Soft Veto thresholds.
  - `core/auth.py`: Cryptographic authentication module generating PBKDF2 HMAC SHA256 hashes and standard Base64 session tokens.
  - `core/db.py`: Universal SQL abstraction layer providing single-query compatibility across both SQLite and PostgreSQL backends.

---

## 🔑 Authentication & Authorization Flow

HireGrid.io implements secure multi-tenant user access:

1. **Email / Password Authentication**:
   - Passwords are never stored in plain text.
   - Salt generation: 16 random bytes via `os.urandom(16)`.
   - Key derivation: `hashlib.pbkdf2_hmac('sha256', password, salt, 100_000)`.
2. **Google OAuth 2.0 Validation**:
   - Google ID Tokens are verified directly against Google's `https://oauth2.googleapis.com/tokeninfo` endpoint.
   - Accounts are automatically auto-provisioned upon first verified Google login.
3. **Session Tokens & Headers**:
   - Successful auth yields a token containing encoded JSON claims (`email`, `role`, `timestamp`, `signature`).
   - Protected API requests include header: `Authorization: Bearer <TOKEN>`.

---

## 📡 Real-Time SSE Streaming Architecture

To eliminate UI lag during batch resume parsing (which can take 1-3 seconds per document), HireGrid.io uses **Server-Sent Events (SSE)** via HTTP POST/GET endpoints (`/api/screenings/stream`):

```
Client (Next.js)                         Backend (FastAPI)
  │                                           │
  ├─────── POST /api/screenings/stream ──────►│ (Form Data + Files)
  │        Content-Type: multipart/form-data │
  │                                           │ 1. Create screening record
  │◄────── 200 OK (text/event-stream) ────────┤
  │                                           │ 2. Loop over PDF documents:
  │◄────── event: progress (Parsing CV 1) ────┤    - Extract PDF text
  │◄────── event: candidate_done ─────────────┤    - Run spaCy entity extraction
  │                                           │    - Compute vector embeddings
  │◄────── event: progress (Parsing CV 2) ────┤    - Run composite scoring
  │◄────── event: candidate_done ─────────────┤    - Save candidate in DB
  │                                           │
  │◄────── event: complete ───────────────────┤ 3. Finish stream connection
```

---

## 🔐 Security & Data Protection

- **CORS Middleware**: Explicit origin validation matching configured `ALLOWED_ORIGINS` environment variables.
- **Role Validation**: Restricts profile privilege assignment to valid recruiter roles (`Recruitment Lead`, `Technical Recruiter`, `HR Manager`).
- **File System Isolation**: Uploaded resumes stored in isolated UUID-backed server directories (`/backend/uploads/{screening_id}/`).
