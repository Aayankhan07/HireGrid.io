# Scoring Engine & NLP Pipeline — HireGrid.io

Technical specification of the resume parsing, entity extraction, vector
embedding, and composite fit scoring engine.

---

## 🧠 Overview

The pipeline has four stages:

1. **PDF text extraction** — `pdfplumber` (`core/parser.py`)
2. **Rule-based attribute extraction** — regex and phrase matching (`core/nlp_layer.py`)
3. **Transformer embeddings** — `sentence-transformers/all-MiniLM-L6-v2` (`core/similarity.py`)
4. **Composite scoring** — weighted multi-factor scoring with a soft-veto
   guardrail (`core/rules_engine.py`)

A cross-cutting skill-alias layer (`core/skill_aliases.py`) normalises skill
vocabulary before any comparison happens.

> **On spaCy.** Earlier revisions loaded `en_core_web_sm` at import. Extraction
> never called it — every field is regex/rule-derived — so both the load and the
> dependency were removed, along with `pytesseract`/`Pillow` (OCR was never
> wired up). NER was specifically rejected for name detection because it tags
> resume section headers ("PROFESSIONAL SUMMARY", "CAREER OPPORTUNITY") as
> `PERSON` entities, and in testing it also mislabelled companies as people
> (`DataCorp Analytics BV` → `PERSON`) and the Go language as a country
> (`Go` → `GPE`).
>
> If NER is reintroduced — employer extraction is the plausible use — add
> `spacy` back and import it lazily inside the function that needs it, rather
> than at module import.

---

## 🔤 Skill Alias Normalisation (`core/skill_aliases.py`)

Resumes and job descriptions rarely spell a technology identically. Matching raw
strings means a CV saying `ReactJS`, `k8s`, or `Postgres` fails against a
requirement for `React`, `Kubernetes`, or `PostgreSQL` — and, before this layer
existed, such candidates were auto-rejected before any semantic comparison ran.

Surface forms are folded onto a canonical token:

| Canonical | Recognised surface forms (excerpt) |
|---|---|
| `kubernetes` | `k8s`, `kube` |
| `postgresql` | `postgres`, `psql` |
| `react` | `reactjs`, `react.js` |
| `node.js` | `node`, `nodejs` |
| `computer vision` | `opencv`, `cnn`, `yolo`, `object detection`, `image processing` |
| `ci/cd` | `cicd`, `continuous integration`, `continuous delivery` |

Four helpers are exported:

| Function | Purpose |
|---|---|
| `canonicalize_skill(s)` | One name → canonical token (unknown names pass through lowercased) |
| `canonicalize_skills(xs)` | Collection → set of canonical tokens |
| `expand_skill_lexicon(xs)` | Widens a lexicon with alias forms so extraction can find them in text |
| `skills_intersect(req, cand)` | Canonical-aware intersection |

Normalisation is applied in extraction, exact-match scoring, density scoring, and
matched/missing computation, so the four stay consistent.

**To add a skill or alias**, edit `_ALIAS_GROUPS` in `core/skill_aliases.py`:

```python
_ALIAS_GROUPS = {
    "graphql": ["gql", "apollo graphql"],
}
```

The general technical vocabulary lives separately in `MASTER_SKILL_LEXICON` in
`backend/app.py`; skills named in a job's `required_skills` are added to the
lexicon automatically per request.

---

## 🔬 Extraction Pipeline (`core/nlp_layer.py`)

`extract_all(text, skill_lexicon, filename)` returns every field below in one pass.

| Field | Technique | Example |
|---|---|---|
| **Email** | Regex | `alex@email.com` |
| **Phone** | Digit-group regex validated to 7–15 digits (E.164 range) | `+1 555-0199` |
| **Candidate name** | First header-zone line matching a 2–4 capitalised-word pattern, with a stop-list; falls back to a cleaned filename | `Alex Rivera` |
| **Skills** | Word-boundary phrase matching against the alias-expanded lexicon | `["Python", "FastAPI"]` |
| **Skill density** | Occurrence count per skill, folded onto canonical names | `{"python": 5, "docker": 1}` |
| **Experience (YOE)** | Date-range parsing, interval merge, education sections excluded | `5.5` |
| **Education level** | Degree keyword scan taking the **highest** level found | `"Bachelor"` |
| **Education detail** | Field-of-study and institution regexes | `{"level": "Master", "field": "Computer Science", ...}` |
| **Location** | Four-tier resolution (see below) | `"New York"` |
| **Certifications** | Keyword list match | `["Aws Certified"]` |
| **Languages** | Language-section regex | `["English", "Spanish"]` |
| **Projects** | Action-verb bullet extraction, max 5 | `["Architected a payment gateway..."]` |
| **Job titles** | Modifier + field + role pattern, max 3 | `["Senior Software Engineer"]` |

### Experience calculation

Date ranges (`2019 - 2024`, `Jan 2020 - Present`, `03/2018 - 06/2021`) are parsed
into intervals, **overlapping intervals are merged** so concurrent roles are not
double-counted, and the total is returned in years.

`strip_education_sections()` runs first. Degree date ranges are
textually identical to employment ranges, so without this a candidate's entire
schooling is counted as professional experience. Sections are detected by
heading (`Education`, `Certifications`, `Courses`, …) and end at the next
work-related heading.

### Education level

All degree keywords in the document are scanned and the **highest** rank wins
(`Unknown 0 < High School 1 < Bachelor 2 < Master 3 < PhD 4`). Returning the
first match made the result depend on dictionary ordering — a resume mentioning
"supervised master's students" while holding a Bachelor reported `Master`.

### Location

Resolved in reliability order, stopping at the first hit:

1. An explicit `Location:` / `Based in:` / `Address:` label
2. A ~60-entry known-city list
3. A structural `City, Region` pattern, restricted to the first 600 characters
   so body prose does not produce false positives
4. A bare work-arrangement keyword (`remote`, `hybrid`, `on-site`)

Unresolved locations return `""`, which scores `50.0` — neutral, not penalised.

---

## 🧮 Vector Similarity (`core/similarity.py`)

- **Model**: configurable via `EMBEDDING_MODEL`, default `all-MiniLM-L6-v2`
- **Metric**: cosine similarity

### Choosing a model

The embedding model carries **40% of the composite score** — more than any other
component — so it is both the highest-leverage thing to change and the easiest
to get wrong. `MODEL_REGISTRY` holds each supported model together with its own
calibration band, query prefix, and normalisation setting, because raw cosine
distributions are model-specific: swapping a model without re-calibrating
silently changes every score in the system.

| Model | Dims | Notes |
|---|---|---|
| `all-MiniLM-L6-v2` | 384 | Default. Fastest, widest score separation on this benchmark. |
| `BAAI/bge-small-en-v1.5` | 384 | Higher MTEB score; needs a query prefix and much higher calibration floors. |
| `BAAI/bge-base-en-v1.5` | 768 | Larger BGE variant. |
| `sentence-transformers/all-mpnet-base-v2` | 768 | Strong general-purpose symmetric model. |

> **A better benchmark score does not mean a better model here.** MTEB measures
> retrieval over web passages; this system ranks resumes against a job
> description. Measured on this repo's suite, `bge-small` compressed the usable
> range — an off-domain nurse resume scored **0.52** cosine against a backend
> engineering JD versus **0.10** for MiniLM — and mis-ordered a candidate pair
> (Kendall tau 0.926 vs 1.000). MiniLM remains the default on that evidence.

Before changing `EMBEDDING_MODEL`, run:

```bash
python accuracy_checker/compare_models.py
```

It evaluates each model end to end in a subprocess (necessary, since calibration
is resolved at import) and reports NDCG@3, P@1, Kendall tau, and extraction
accuracy side by side.

### Section chunking

Scoring previously compared the JD against `resume_text[:1500]`. For a two-page
CV that is the header plus the most recent role — everything after it was
invisible to the strongest-weighted component in the system.

`split_into_chunks()` now segments the resume on section headings, splits long
sections on paragraph boundaries, and merges undersized fragments forward. Each
chunk is embedded separately and the score blends the best-matching chunk with
the mean across all chunks:

```
score = (best_chunk × CHUNK_MAX_WEIGHT) + (mean_chunks × (1 − CHUNK_MAX_WEIGHT))
```

`CHUNK_MAX_WEIGHT` defaults to `0.7`. Pure max rewards one lucky paragraph; pure
mean punishes long resumes, since genuinely irrelevant sections (interests,
early career) drag the average down.

**Measured effect.** A candidate whose platform experience sits after ~3000
characters of unrelated support history:

| | Semantic score |
|---|---|
| Old (first 1500 chars) | **3.58** |
| New (chunked) | **58.97** |

At 3.58 that candidate fell below the relevance floor and was auto-rejected.

**`compute_semantic_similarity(job_description, candidate_summary)`** compares
the job description against the first 1500 characters of the resume.

**`compute_batch_skill_similarity(required, candidate_skills, summary)`** builds a
compact context from the extracted skill tokens plus a summary excerpt, adds the
canonical form of each extracted skill, then uses **max-then-mean** aggregation:
each required skill takes its best cosine match among candidate items, and those
maxima are averaged.

**`compute_semantic_similarity_batch(jd, summaries)`** scores many candidates in
one forward pass. Encoding one candidate at a time wastes most of the model's
throughput.

### Score calibration — read this before trusting the numbers

Raw cosine similarity does not span `[0, 1]` in practice. Unrelated professional
text still scores ≈ 0.15 because it shares register and vocabulary, and
well-matched pairs plateau well below 1.0. Mapping the raw range directly onto
0–100 compresses every real candidate into a narrow mid band.

Scores are therefore stretched from a usable band onto the full output range:

```
calibrated = clamp( (raw - floor) / (ceiling - floor) * 100, 0, 100 )
```

| Band | Env var | Default |
|---|---|---|
| Semantic floor | `SEMANTIC_FLOOR` | `15.0` |
| Semantic ceiling | `SEMANTIC_CEILING` | `65.0` |
| Skill floor | `SKILL_FLOOR` | `15.0` |
| Skill ceiling | `SKILL_CEILING` | `70.0` |

> **These bounds are heuristic defaults, not fitted to labelled data.** Treat the
> resulting numbers as **ordinal** — useful for ranking candidates against each
> other within one screening — and not as calibrated probabilities or
> cross-run-comparable percentages. Re-tune against your own labelled set using
> `accuracy_checker/evaluator.py`, which measures ranking quality (NDCG,
> Precision@k) rather than absolute score values.

---

## ⚖️ Composite Scoring (`core/rules_engine.py`)

### 1. Weights

| Component | Weight |
|---|---|
| Semantic match | 40% |
| Blended skills | 20% |
| Experience | 15% |
| Education | 10% |
| Certifications | 5% |
| Location | 5% |
| Language | 5% |

### 2. Blended skill sub-score

```
Blended = 0.40 × Exact + 0.30 × Density + 0.30 × SemanticSkill
```

- **Exact** — weighted canonical-name intersection over required skills, ×100
- **Density** — penalises single-mention keyword stuffing:
  1 mention → ×0.4, 2 → ×0.7, ≥3 → ×1.0
- **SemanticSkill** — the calibrated batch skill similarity above

### 2b. Skill importance weighting (`core/skill_weights.py`)

Every required skill used to count equally, so a role's core language and a
peripheral ticketing tool moved the score by the same amount. A job description
can now mark importance with a suffix on the skill name:

| Syntax | Meaning | Weight |
|---|---|---|
| `Python!` | must-have | 2.0 |
| `PostgreSQL` | standard | 1.0 |
| `Jira?` | nice-to-have | 0.5 |

```
Required skills: React!, TypeScript!, Node.js, Next.js?, PostgreSQL
```

Markers are stripped during parsing, so everything downstream — matching,
display, storage — sees ordinary skill names. A JD written without any markers
behaves exactly as before.

**Missing a must-have caps the skills sub-score at 75%.** A weighted average
alone cannot express "this one is disqualifying": with several other strong
matches, a candidate lacking the single non-negotiable skill would still score
comfortably. The cap and the reason both appear in the candidate's `audit_log`.

### 2c. Negation handling

Skill matching is substring-based, so a resume saying *"no Kubernetes exposure"*
or *"looking to learn Rust"* was previously credited with the skill — inflating
scores for exactly the candidates a recruiter most needs filtered out.

`extract_skills` and `extract_skills_with_density` now check a window around
each mention for negation cues, in both directions (`no Kubernetes experience`,
`Kubernetes was not used`). The window is clipped at sentence and bullet
boundaries so a negation about one skill cannot suppress an unrelated claim, and
a skill negated in one place but claimed in another still counts.

### 3. Soft veto

Prevents a non-technical candidate from ranking high on location, language, and
education alone.

```
TechScore = (Blended × 0.20) + (Semantic × 0.40)      # max 60
TechRatio = 1.0                    if TechScore ≥ 30
            max(0.4, TechScore/30) otherwise
```

Experience and education contributions are multiplied by `TechRatio`.
Certification, location, and language are not scaled. The returned payload
reports whether this fired via `soft_veto_applied`.

### 4. Experience and education

```
ExperienceScore = 100                        if candidate YOE ≥ required
                  (candidate / required)×100 otherwise
```

Education uses the level hierarchy; meeting or exceeding the requirement scores
`100.0`, otherwise it scales proportionally.

### 5. Penalties

**Seniority deficit** — a senior/lead/principal role where *every* extracted past
title is junior/intern level multiplies the total by `0.75`.

**Experience deficit** — a piecewise penalty subtracted from the total, capped at
25 points:

| Shortfall | Penalty |
|---|---|
| ≤ 2 years | `deficit × 3` |
| 2–5 years | `6 + (deficit − 2) × 4` |
| > 5 years | `18 + (deficit − 5) × 1.5` |

> This intentionally double-counts experience: the 15% weighted term alone moves
> the total by at most 15 points, which does not separate a 1-year applicant from
> a 6-year one for a 7-year role. The cap bounds the combined effect.

The final score is clamped to `[0, 100]`.

### 6. Return shape

```python
{
  "final_score": 88.5,
  "soft_veto_applied": False,
  "seniority_deficit_applied": False,
  "experience_penalty": 0.0,
  "missing_must_haves": [],          # skills marked "!" that the candidate lacks
  "breakdown": { "skills": 90.0, "semantic_similarity": 85.2, ... },
  "audit_log": { "experience": "...", "seniority": "...", ... }
}
```

`audit_log` carries a human-readable justification per component and is surfaced
in the UI so a recruiter can see why a candidate scored as they did.

---

## 🚧 Relevance Floor (Auto-Rejection)

A candidate is marked `Auto-Rejected` when **both** hold:

```
skill_similarity < AUTO_REJECT_SKILL_SIM   (default 10.0)
semantic_score   < AUTO_REJECT_SEMANTIC    (default 20.0)
```

Two properties matter:

1. **It runs after the semantic layer**, never on exact string overlap. An
   earlier revision rejected on zero literal skill intersection, which discarded
   qualified candidates purely for writing `ReactJS` instead of `React`.
2. **Rejected candidates are recorded, not discarded.** They are persisted with
   `status: "Auto-Rejected"` and returned in `rejected_candidates` with an
   `audit_log` reason. Screening decisions need to remain auditable.

---

## 📏 Evaluating Scoring Changes (`accuracy_checker/evaluator.py`)

Run the benchmark before and after any change to weights, calibration, or
extraction:

```bash
python accuracy_checker/evaluator.py              # full report
python accuracy_checker/evaluator.py --min-ndcg 0.9   # CI gate, non-zero exit on regression
```

It runs the **real** pipeline — extraction, embeddings, composite scoring — over
hand-graded resume/job pairs and reports:

| Metric | Question it answers |
|---|---|
| **Precision@k** | Of the top k, how many are genuinely relevant? |
| **NDCG@k** | Are the strongest candidates ranked highest? |
| **Kendall tau** | How well does the predicted order match the ideal order? |
| **Extraction accuracy** | Did parsing recover YOE and education correctly? |

Extraction is scored separately because a ranking error caused by a parsing bug
needs a different fix from one caused by scoring weights.

> **The bundled benchmark is small** (8 candidates, 2 jobs) and hand-written. It
> is a regression detector, not evidence of general accuracy — do not quote its
> numbers as an accuracy claim. Growing it toward 50+ real, independently graded
> resume/JD pairs is what would make it meaningful.
