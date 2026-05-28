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
| NLP | spaCy, sentence-transformers, pdfplumber |
| Database | SQLite |

## Usage

1. Sign up or log in
2. Click **"Create Screening Run"**
3. Fill in the job title, description, required skills, and upload CVs
4. Watch real-time analysis and review ranked candidates

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Docker

```bash
docker build -t hiregrid .
docker run -p 7860:7860 hiregrid
```
