# HireGrid.io — Technical Documentation Hub

Welcome to the documentation hub for **HireGrid.io**, an enterprise-grade AI-powered candidate screening and talent ranking platform.

---

## 📚 Documentation Index

| Document | Description | Target Audience |
|---|---|---|
| 📐 [**System Architecture**](architecture.md) | Technical architecture, FastAPI backend, Next.js frontend, real-time SSE streaming, and security model. | Architects & Lead Developers |
| 🔌 [**API Reference**](api-reference.md) | REST API endpoints, SSE stream specifications, authentication payloads, and error codes. | Backend & Frontend Developers |
| 🧠 [**Scoring Engine & NLP Pipeline**](scoring-engine-and-nlp.md) | Deep breakdown of the v3 Composite Scoring algorithm, Soft Veto rule, skills density penalty, sentence-transformers, and spaCy CV parsing. | Data Scientists & ML Engineers |
| 🗄️ [**Database Schema**](database-schema.md) | Entity relationship models, table definitions (`users`, `screenings`, `candidates`), and dual SQLite/PostgreSQL layer. | Database Administrators & Developers |
| 🛠️ [**Setup & Deployment Guide**](setup-and-deployment.md) | Local environment installation, environment variables configuration, Docker build, and HuggingFace/Cloud deployment. | DevOps & System Engineers |
| 📖 [**User & Developer Guide**](user-and-developer-guide.md) | End-to-end user workflow guide for recruiters, developer contribution guidelines, unit testing, and troubleshooting. | Recruiters, Product Managers & Contributors |

---

## 🎯 System Overview

HireGrid.io streamlines the recruitment workflow by automatically processing PDF resumes against job descriptions, extracting candidate attributes using spaCy NLP models, calculating semantic match scores via Sentence Transformers (`all-MiniLM-L6-v2`), and computing multi-factor composite fit scores.

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
│   spaCy NLP &    │         │     Sentence     │         │ Rule Engine v3   │
│ pdfplumber Parser│         │   Transformers   │         │ (Composite Score)│
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## ⚡ Quick Start

```bash
# 1. Clone & setup backend
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app:app --reload --port 8000

# 2. Setup frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to access the application UI.

---

## 🛡️ Security & Privacy
- **Password Security**: Passwords hashed using PBKDF2 with HMAC SHA256 and unique 16-byte random salts.
- **Authentication**: JWT session tokens with bearer authentication.
- **OAuth**: Google OAuth 2.0 token validation.
- **Data Isolation**: Multi-tenant screening runs scoped strictly to authenticated user email.
