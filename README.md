---
title: HireGrid.io
emoji: 🎯
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
short_description: AI-powered CV screening and talent ranking platform
pinned: false
---

# HireGrid.io

> **AI-powered CV Screening & Talent Ranking Platform**

HireGrid.io is an enterprise-grade recruitment intelligence platform that uses NLP, semantic similarity, and composite scoring rules to rank candidates against job requirements.

## Features

- 📄 **Multi-CV Upload** — Batch upload and parse PDF resumes
- 🧠 **Semantic Matching** — Sentence-transformer embeddings vs job description
- 🏆 **Composite Scoring** — Skills, experience, education, location, certifications
- 📊 **Deep Analytics** — Score breakdowns, skill gap analysis, pipeline yield
- 🔐 **Auth** — Email/password + Google OAuth sign-in
- ⚡ **Real-time Streaming** — SSE progress feed during analysis

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Parsing | pdfplumber + rule-based extraction |
| Embeddings | sentence-transformers (configurable, default `all-MiniLM-L6-v2`) |
| Database | SQLite (default) / PostgreSQL |

## Usage

1. Sign up or log in
2. Click **"Create Screening Run"**
3. Fill in the job title, description, required skills, and upload CVs
4. Watch real-time analysis and review ranked candidates

### Marking skill importance

Suffix a required skill to weight it:

```
React!, TypeScript!, Node.js, Next.js?, PostgreSQL
```

`!` = must-have (double weight; missing it caps the skills score at 75%).
`?` = nice-to-have (half weight). Unmarked skills carry normal weight, so a
list written without markers behaves exactly as before.

## Local Development

```bash
# Configure — JWT_SECRET is required in production and recommended locally
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"

# Backend
cd backend
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend && python -m pytest tests/ -q
python accuracy_checker/evaluator.py --min-ndcg 0.9   # scoring benchmark
```

## Docker

```bash
docker build --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-id> -t hiregrid .

docker run -p 7860:7860 \
  -e ENV=production \
  -e JWT_SECRET=<generated-secret> \
  -v hiregrid_uploads:/app/backend/uploads \
  hiregrid
```

## Documentation

Full technical documentation in [`docs/`](docs/README.md) — architecture, API
reference, scoring engine, database schema, deployment, and troubleshooting.

## Note on Scoring

Fit scores rank candidates relative to each other within a screening. They are
not calibrated percentages and should not be read as "X% qualified". Every
candidate carries an audit log explaining their score, and candidates filtered
out are recorded with a reason rather than discarded. Automated screening is a
triage aid, not a hiring decision.
