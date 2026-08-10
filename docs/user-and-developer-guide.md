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
   - **Required Skills**: Comma-separated (e.g. `Python, React, Docker, PostgreSQL`).
     Mark importance with a suffix — see below.
   - **Required Experience (Years)**: Minimum years of candidate experience expected.
   - **Required Education**: Select target degree level (`Any`, `Bachelor`, `Master`, `PhD`).
   - **Preferred Location**: e.g., `New York, USA` or `Remote`.
3. **Upload Candidate CVs**:
   - Drag & drop or select multi-candidate PDF resumes (supports batch processing up to dozens of CVs).
4. Click **"Start Screening"**.

#### Marking skill importance

Not every requirement matters equally. Add a suffix to say so:

| You type | Meaning | Effect |
|---|---|---|
| `Python!` | Must-have | Counts double. Missing it caps the candidate's skills score at 75%. |
| `PostgreSQL` | Standard | Normal weight. |
| `Jira?` | Nice-to-have | Counts half. |

```
React!, TypeScript!, Node.js, Next.js?, PostgreSQL
```

Leave the markers off and every skill is weighted equally, exactly as before.
When a candidate is missing a must-have, their candidate drawer says so
explicitly rather than just showing a lower number.

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
- **Pipeline Status Selection**: `Applied`, `Screening`, `Shortlisted`,
  `Interview`, `Offer`, `Hired`, `Rejected`, `Auto-Rejected`.
- **Side-by-Side Comparison**: Check candidates to launch the **Candidate Comparison Modal** for head-to-head metric evaluations.

---

### 5. Understanding Auto-Rejected Candidates

Candidates far below the job's requirements are marked **`Auto-Rejected`**,
scored `0.0`, and excluded from the ranking — but they are **kept and shown**,
never silently dropped. Each carries an `audit_log` stating why.

Two things worth knowing:

- **A rejection is a filtering decision, not a verdict.** The floor is
  deliberately low (see [Scoring Engine](scoring-engine-and-nlp.md)); review the
  rejected list rather than assuming it is noise.
- **Scores rank, they do not certify.** A score of 82 means "ranked above the
  one scoring 74 for this job", not "82% qualified". Treat the ordering as a
  triage aid and the `audit_log` as the thing to actually read. Automated scores
  should not be the sole basis for rejecting an applicant.

---

## 💻 Developer & Contribution Guide

### 1. Codebase Structure

```
HireGrid.io/
├── backend/
│   ├── app.py                # Routes, CORS, auth, rate limiting, scoring pipeline
│   ├── core/
│   │   ├── auth.py           # PBKDF2 hashing & HMAC session tokens
│   │   ├── db.py             # SQLite/PostgreSQL layer, pooling, ownership queries
│   │   ├── nlp_layer.py      # Rule-based resume attribute extraction
│   │   ├── parser.py         # pdfplumber PDF text extraction
│   │   ├── rules_engine.py   # Composite scoring, soft veto, penalties
│   │   ├── similarity.py     # Embeddings, model registry, calibration
│   │   ├── skill_aliases.py  # Skill vocabulary normalisation
│   │   └── skill_weights.py  # Must-have / nice-to-have importance parsing
│   ├── tests/
│   │   ├── test_api.py            # Endpoint smoke tests
│   │   ├── test_auth.py           # Hashing & token verification
│   │   ├── test_authorization.py  # Object-level access control
│   │   ├── test_nlp_layer.py      # Extraction correctness
│   │   ├── test_rules_engine.py   # Scoring components
│   │   └── test_tier2_scoring.py  # Chunking, weighting, negation, model config
│   ├── uploads/              # Stored resume PDFs (gitignored — personal data)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js 16 App Router pages
│   │   ├── components/       # UI components (Forms, Drawers, Modals)
│   │   ├── context/          # React AuthContext
│   │   ├── hooks/            # useFocusTrap (modal focus containment)
│   │   ├── lib/              # score.ts (shared score tiers & colours)
│   │   └── types/            # TypeScript interfaces
│   ├── scripts/              # check-classes / check-contrast / check-a11y gates
│   └── package.json
├── accuracy_checker/
│   ├── evaluator.py          # Scoring benchmark (NDCG, Precision@k)
│   └── compare_models.py     # Side-by-side embedding model comparison
└── docs/                     # Technical documentation suite
```

---

### 1b. Running the Test Suite

```bash
cd backend
python -m pytest tests/ -q                 # 56 tests
python -m pytest tests/test_authorization.py -v   # access-control only
```

```bash
# Scoring regression benchmark, from the repository root.
# Exits non-zero if ranking quality drops below the threshold.
python accuracy_checker/evaluator.py --min-ndcg 0.9

# Compare embedding models before changing EMBEDDING_MODEL.
python accuracy_checker/compare_models.py
```

Frontend gates — `npm run verify` runs all three plus `tsc`:

```bash
cd frontend
npm run lint:classes    # Tailwind classes that emit no CSS
npm run lint:contrast    # design tokens below WCAG AA
npm run lint:a11y        # jsx-a11y violations only
npm run verify           # all of the above + tsc --noEmit
```

`lint:classes` exists because Tailwind silently ignores a shade outside its
palette: `text-slate-450` compiles, ships, and renders unstyled. 68 such classes
had accumulated before the check was added.

CI (`.github/workflows/ci.yml`) runs the pytest suite, the scoring benchmark,
all three frontend gates, `tsc --noEmit`, and the Next.js build on every push
and pull request.

**When adding a feature that touches candidate data, add an authorization test.**
`tests/test_authorization.py` follows a two-user pattern — create a resource as
one user, assert the other receives `404`. That file exists because ownership
checks were once missing entirely.

---

### 2. Customizing Skill Extraction

Skill handling lives in two places, and which one you edit depends on the goal.

**To teach the system a new technology**, add it to `MASTER_SKILL_LEXICON` in
`backend/app.py` (lowercase entries):

```python
MASTER_SKILL_LEXICON = {
    "python", "javascript", "typescript",
    "graphql",   # ← new entry
}
```

Skills listed in a job's `required_skills` are merged into the lexicon
automatically per request, so a one-off requirement needs no code change.

**To teach the system that two names mean the same thing**, add an alias group in
`backend/core/skill_aliases.py`:

```python
_ALIAS_GROUPS = {
    "graphql": ["gql", "graph-ql", "apollo graphql"],
}
```

Aliases matter more than they look. Extraction scans the resume for literal
lexicon entries, so without an alias entry a CV saying `gql` yields no GraphQL
skill at all — and a candidate with no matching skills can fall below the
relevance floor. Alias groups are consulted by extraction, exact-match scoring,
density scoring, and matched/missing computation alike.

After either change, re-run the benchmark to confirm nothing regressed:

```bash
python accuracy_checker/evaluator.py --min-ndcg 0.9
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

### Q1: `RuntimeError: JWT_SECRET must be set when ENV=production`
**Cause**: intentional. There is no shipped default signing key, because a
published default lets anyone forge a session token.
**Solution**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
Put the value in `JWT_SECRET`. Rotating it invalidates all existing sessions.

### Q2: Everyone is logged out after every restart (development)
**Cause**: `JWT_SECRET` is unset, so a random key is generated per process. The
startup log warns about this.
**Solution**: set `JWT_SECRET` in `.env`.

### Q3: I cannot log in as admin — no password was printed
**Cause**: with `ADMIN_PASSWORD` unset, development seeds a random password and
logs it **once** at first startup; production skips the admin seed entirely.
**Solution**: set `ADMIN_PASSWORD` and delete `backend/hiregrid.db` to re-seed,
or register a normal account via `/api/auth/signup`.

### Q4: `429 Too Many Requests` on login
**Cause**: login throttling — 10 failed attempts per 5 minutes per IP + email.
**Solution**: wait for the `Retry-After` interval. A successful login clears the
counter. Tune with `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_SECONDS`.

### Q5: A qualified candidate was auto-rejected
**Cause**: usually vocabulary. Extraction matches literal strings from the
lexicon, so an unrecognised spelling yields no skill match.
**Solution**: add the spelling to `_ALIAS_GROUPS` in `core/skill_aliases.py`
(section 2 above). If the candidate is genuinely relevant but phrased unusually
throughout, lower `AUTO_REJECT_SEMANTIC` / `AUTO_REJECT_SKILL_SIM`.

### Q6: CORS error connecting the frontend to the backend
**Solution**: set `ALLOWED_ORIGINS` to your frontend origin. Note that `*` is
rejected — it cannot be combined with credentialed requests — and falls back to
`http://localhost:3000`.

### Q7: `sqlite3.OperationalError: database is locked`
**Cause**: SQLite serialises writes.
**Solution**: use PostgreSQL for anything concurrent —
`DATABASE_URL=postgresql://user:pass@host/db?sslmode=require`.

### Q8: CV downloads return 404 after redeploying
**Cause**: resume PDFs live on the container filesystem and are lost when the
container is replaced.
**Solution**: mount a persistent volume at `/app/backend/uploads`.

### Q9: `404` when accessing a screening or candidate I expect to exist
**Cause**: resources are scoped to their owner, and a resource belonging to
another account returns `404` rather than `403` by design.
**Solution**: confirm you are authenticated as the account that created it.

### Q10: The model downloads on every container start
**Cause**: the sentence-transformer cache is not persisted. The provided
`Dockerfile` pre-downloads it at build time; a custom image may not.
**Solution**: bake the model into the image, or mount a volume for the
HuggingFace cache directory.
