# User & Developer Guide — HireGrid.io

This guide provides end-to-end operational instructions for recruiters using **HireGrid.io**, alongside technical guidelines for software engineers extending or maintaining the codebase.

---

## 👥 Recruiter User Guide

### 1. Authentication & Sign In
1. Launch the application UI (`http://localhost:3000` or production domain).
2. Choose your preferred sign-in method:
   - **Email & Password**: Enter registered recruiter credentials or register a new account.
   - **Google OAuth**: Click "Sign in with Google" for instant one-click authentication.

---

### 2. Creating a Screening Run
1. On the main Dashboard, click **"Create Screening Run"**.
2. **Define Job Requirements**:
   - **Job Title** *(Required)*: e.g. "Senior Full-Stack Engineer".
   - **Job Description**: Paste the full role summary to enable deep semantic vector matching.
   - **Required Skills**: Add comma-separated key skills (e.g. `Python, React, Docker, PostgreSQL`).
   - **Required Experience (Years)**: Minimum years of candidate experience expected.
   - **Required Education**: Select target degree level (`Any`, `Bachelor`, `Master`, `PhD`).
   - **Preferred Location**: e.g., `New York, USA` or `Remote`.
3. **Upload Candidate CVs**:
   - Drag & drop or select multi-candidate PDF resumes (supports batch processing up to dozens of CVs).
4. Click **"Start Screening"**.

---

### 3. Monitoring Live Progress & Reviewing Candidates
1. Watch the **Real-time SSE Progress Feed** parse and evaluate candidate resumes step-by-step.
2. Review the ranked candidate leaderboard:
   - **Composite Fit Score Badge**: Color-coded score (Green \(\ge 80\), Yellow \(\ge 60\), Red \(< 60\)).
   - **Matched vs. Missing Skills**: Quick chip indicators highlighting skill coverage.
   - **Executive Summary**: Automated candidate fit analysis text.

---

### 4. Detailed Candidate Inspection & Comparison
- **Candidate Drawer**: Click any candidate row to inspect detailed component breakdowns:
  - Component fit scores (Skills, Semantic, Experience, Education, Location, Certifications).
  - Recruiter Notes text box to save interview notes.
  - Download original PDF resume button.
- **Pipeline Status Selection**: Change candidate status dropdown (`Applied`, `Shortlisted`, `Interviewing`, `Rejected`, `Hired`).
- **Side-by-Side Comparison**: Check candidates to launch the **Candidate Comparison Modal** for head-to-head metric evaluations.

---

## 💻 Developer & Contribution Guide

### 1. Codebase Structure

```
HireGrid.io/
├── backend/
│   ├── app.py                # FastAPI web routes, CORS, auth, SSE streams
│   ├── core/
│   │   ├── auth.py           # PBKDF2 hashing & JWT session tokens
│   │   ├── db.py             # Dual SQLite / PostgreSQL data access layer
│   │   ├── nlp_layer.py      # spaCy NER & skill phrase extraction
│   │   ├── parser.py         # pdfplumber PDF extraction
│   │   ├── rules_engine.py   # v3 Composite Scoring & Soft Veto logic
│   │   └── similarity.py     # Sentence-Transformers vector similarity
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js 16 App Router pages
│   │   ├── components/       # UI components (Forms, Drawers, Modals)
│   │   ├── context/          # React AuthContext
│   │   └── types/            # TypeScript interfaces
│   └── package.json
└── docs/                     # Technical documentation suite
```

---

### 2. Customizing NLP Skill Extraction (`core/nlp_layer.py`)

To add new technical skills or aliases to the extraction dictionary, update the `SKILLS_DB` dictionary in `backend/core/nlp_layer.py`:

```python
SKILLS_DB = {
    "Python": ["python", "py", "python3"],
    "FastAPI": ["fastapi", "fast-api"],
    "Rust": ["rust", "rustlang"],
    # Add new skill entry:
    "GraphQL": ["graphql", "graph-ql", "apollo graphql"]
}
```

---

### 3. Adjusting Composite Scoring Weights (`core/rules_engine.py`)

To modify component weightings in the fit calculation, edit the `weights` dictionary in `compute_final_score()` inside `backend/core/rules_engine.py`:

```python
weights = {
    "semantic":       0.40,  # Transformer vector similarity (40%)
    "skills":         0.20,  # Blended skill score (20%)
    "experience":     0.15,  # Years of experience duration (15%)
    "education":      0.10,  # Degree level match (10%)
    "certifications": 0.05,  # Industry certification match (5%)
    "location":       0.05,  # Preferred location match (5%)
    "language":       0.05,  # Language proficiency match (5%)
}
```

---

## ❓ Troubleshooting & FAQ

### Q1: `spacy.errors.OSError: [E050] Can't find model 'en_core_web_sm'`
**Solution**: Download the spaCy English model inside your active Python virtual environment:
```bash
python -m spacy download en_core_web_sm
```

### Q2: CORS error when connecting Next.js frontend to FastAPI backend
**Solution**: Ensure your `.env` file specifies `ALLOWED_ORIGINS=http://localhost:3000` (or your frontend origin URL).

### Q3: `sqlite3.OperationalError: database is locked`
**Solution**: SQLite locks write operations during concurrent access. For multi-threaded production scaling, configure PostgreSQL via `DATABASE_URL=postgresql://user:pass@host:5432/dbname`.
