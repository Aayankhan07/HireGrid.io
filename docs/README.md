# HireGrid.io — Technical Documentation Hub

Welcome to the documentation hub for **HireGrid.io**, an enterprise-grade AI-powered candidate screening and talent ranking platform.

---

## 📚 Documentation Index

| Document | Description | Target Audience |
|---|---|---|
| 📐 [**System Architecture**](architecture.md) | Technical architecture, FastAPI backend, Next.js frontend, real-time SSE streaming, and security model. | Architects & Lead Developers |
| 🔌 [**API Reference**](api-reference.md) | REST API endpoints, SSE stream specifications, authentication payloads, and error codes. | Backend & Frontend Developers |
| 🧠 [**Scoring Engine & NLP Pipeline**](scoring-engine-and-nlp.md) | Composite scoring, soft veto, skill importance weighting, section chunking, embedding model selection, and rule-based CV parsing. | Data Scientists & ML Engineers |
| 🗄️ [**Database Schema**](database-schema.md) | Entity relationship models, table definitions (`users`, `screenings`, `candidates`), and dual SQLite/PostgreSQL layer. | Database Administrators & Developers |
| 🛠️ [**Setup & Deployment Guide**](setup-and-deployment.md) | Local environment installation, environment variables configuration, Docker build, and HuggingFace/Cloud deployment. | DevOps & System Engineers |
| 📖 [**User & Developer Guide**](user-and-developer-guide.md) | End-to-end user workflow guide for recruiters, developer contribution guidelines, unit testing, and troubleshooting. | Recruiters, Product Managers & Contributors |

---

## 🎯 System Overview

HireGrid.io processes PDF resumes against a job description: it extracts
candidate attributes with a rule-based parser, computes semantic match scores
with Sentence Transformers (configurable; `all-MiniLM-L6-v2` by default), and
combines them into a weighted composite fit score with a per-component audit
trail.

```
                  ┌──────────────────────────────────────────┐
                  │          Next.js 16 Client App           │
                  │   (Dashboard, Forms, SSE Stream, Modal)  │
                  └────────────────────┬─────────────────────┘
                                       │ HTTP / REST / SSE
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │           FastAPI Web Service            │
                  │  (Auth, Upload Handler, Stream Engine)   │
                  └───────┬────────────┬────────────┬────────┘
                          │            │            │
          ┌───────────────┘            │            └───────────────┐
          ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Rule-Based &    │         │     Sentence     │         │ Rule Engine v3   │
│ pdfplumber Parser│         │   Transformers   │         │ (Composite Score)│
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## ⚡ Quick Start

```bash
# 0. Configure environment
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # paste into JWT_SECRET

# 1. Backend
cd backend
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`. Full instructions in
[Setup & Deployment](setup-and-deployment.md).

---

## 🛡️ Security & Privacy

- **Passwords**: PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte random salt,
  constant-time verification.
- **Sessions**: HMAC-SHA256 signed tokens with a 24-hour expiry. No shipped
  default signing key — production refuses to start without `JWT_SECRET`.
- **OAuth**: Google ID tokens verified server-side; the development bypass is
  disabled unconditionally when `ENV=production`.
- **Authorization**: every screening and candidate is scoped to its owner, with
  ownership enforced inside the SQL statement. Cross-account access returns
  `404`. Covered by `backend/tests/test_authorization.py`.
- **Login throttling**: 10 attempts per 5 minutes per IP + email.
- **Uploads**: size-capped, streamed to disk under server-generated names, and
  path-confined on download.

> **Candidate resumes are personal data.** `backend/uploads/` is gitignored —
> do not commit real CVs, and mount a persistent volume for it in production.

---

## ⚠️ Interpreting Scores

Fit scores are **ordinal, not absolute**. They rank candidates against each other
within a single screening; they are not calibrated percentages and are not
comparable across runs with different calibration settings. The `audit_log`
attached to each candidate explains every component of their score and is the
part a recruiter should actually read.

Candidates below the relevance floor are marked `Auto-Rejected` and kept on
record with a stated reason — never silently discarded. Automated scoring is a
triage aid, not a hiring decision.
