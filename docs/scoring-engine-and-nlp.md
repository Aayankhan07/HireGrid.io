# Scoring Engine & NLP Pipeline — HireGrid.io

This document provides a comprehensive technical specification of the candidate parsing, entity extraction, vector embedding, and composite fit scoring engine in **HireGrid.io**.

---

## 🧠 Overview

HireGrid.io replaces simplistic keyword matching with a hybrid NLP pipeline combining:
1. **Rule-based & spaCy NER Parsing**: Extracts structured attributes (experience, skills, education, certifications, locations).
2. **Transformer Embeddings**: Computes semantic context vectors using `sentence-transformers/all-MiniLM-L6-v2`.
3. **Composite Fit Engine v3**: Evaluates weighted multi-factor criteria with a **Soft Veto** guardrail and **Skills Density Calibration**.

---

## 🔬 NLP Extraction Pipeline (`core/nlp_layer.py`)

### 1. Document Parsing & Preprocessing
PDF resumes are parsed via `pdfplumber` (with fallback character cleaning). Text is cleaned by normalizing whitespace, stripping invalid Unicode sequences, and parsing section headers (Experience, Education, Skills, Projects).

### 2. Information Extraction Modules

| Feature | Extraction Technique | Example Output |
|---|---|---|
| **Contact Details** | Regex pattern matching for email and phone numbers | `alex@email.com`, `+1 555-0199` |
| **Skills & Tech Stack** | Phrase matching against a curated dictionary of 200+ technical skills with alias resolution | `["Python", "FastAPI", "Docker", "PostgreSQL"]` |
| **Skill Density** | Counts occurrences of each skill phrase across the document body | `{"Python": 5, "FastAPI": 2, "Docker": 1}` |
| **Experience Years (YOE)**| Regex date range parsing (e.g., `2019 - 2024`, `Jan 2020 - Present`) & cumulative duration calculation | `5.5` years |
| **Education Level** | Degree keyword regex matching (`PhD`, `Master`, `Bachelor`, `High School`) | `"Bachelor"` |
| **Location & GPE** | spaCy Named Entity Recognition (`GPE` entities) | `"New York, NY"` |
| **Certifications** | Industry cert keyword detection (`AWS Certified`, `PMP`, `CKA`, `CISSP`) | `["AWS Certified Solutions Architect"]` |
| **Languages** | Language dictionary matching (`English`, `Spanish`, `French`, `German`) | `["English", "Spanish"]` |

---

## 🧮 Vector Similarity Engine (`core/similarity.py`)

HireGrid.io computes deep semantic match scores between the candidate's resume content and the job description using **Sentence Transformers**:

- **Model**: `all-MiniLM-L6-v2` (384-dimensional dense vector space).
- **Metric**: Cosine Similarity:
  \[
  \text{Similarity} = \frac{\mathbf{v}_{\text{resume}} \cdot \mathbf{v}_{\text{job}}}{\|\mathbf{v}_{\text{resume}}\| \|\mathbf{v}_{\text{job}}\|} \times 100
  \]
- **Batch Skill Similarity**: Encodes required skills vs extracted candidate skills into vector embeddings to identify semantic skill matches (e.g., mapping `"PostgreSQL"` to `"RDBMS"` or `"FastAPI"` to `"REST Web Frameworks"`).

---

## ⚖️ Composite Fit Scoring Engine v3 (`core/rules_engine.py`)

### 1. Weight Distribution

```
                               COMPOSITE FIT SCORE (100%)
  ┌───────────────────────┬───────────────────────┬─────────────────────┐
  │  Semantic Match (40%) │   Skills Fit (20%)    │  Experience (15%)   │
  ├───────────────────────┼───────────────────────┼─────────────────────┤
  │  Education (10%)      │   Certifications (5%) │  Location (5%)      │
  └───────────────────────┴───────────────────────┴─────────────────────┘
  * Language Proficiency contributes up to 5% secondary adjustment.
```

---

### 2. Blended Skill Sub-Score Formula

To prevent keyword stuffing while rewarding core technical depth, the skill score blends three components:

1. **Exact Skill Match Score (40%)**:
   \[
   \text{Exact Score} = \frac{|\text{Required Skills} \cap \text{Candidate Skills}|}{|\text{Required Skills}|} \times 100
   \]
2. **Skills Density Score (30%)**:
   Penalizes single-mention keyword stuffing:
   - Mention Count = 1 \(\rightarrow\) Multiplier: `0.4` (Casual/stuffed mention)
   - Mention Count = 2 \(\rightarrow\) Multiplier: `0.7` (Moderate usage)
   - Mention Count \(\ge\) 3 \(\rightarrow\) Multiplier: `1.0` (Core expertise)
3. **Semantic Skill Similarity (30%)**:
   Vector cosine distance between required skill embeddings and candidate skills.

\[
\text{Blended Skill Score} = (0.40 \times \text{Exact}) + (0.30 \times \text{Density}) + (0.30 \times \text{Semantic Skill})
\]

---

### 3. Soft Veto Guardrail

Traditional weighted scoring systems often rank non-technical candidates high if they possess maximum scores in location, language, and education. HireGrid.io prevents this with a **Soft Veto** rule:

1. Compute Core Tech Score:
   \[
   \text{Tech Score} = (\text{Blended Skill Score} \times 0.20) + (\text{Semantic Score} \times 0.40)
   \]
2. If \(\text{Tech Score} < 30.0\) (out of 60 possible points), calculate a penalty ratio:
   \[
   \text{Tech Ratio} = \max\left(0.4,\, \frac{\text{Tech Score}}{30.0}\right)
   \]
3. The overall composite score is scaled by \(\text{Tech Ratio}\), suppressing non-technical candidate rankings.

---

### 4. Experience & Education Scoring

- **Experience Score**:
  \[
  \text{Experience Score} = \min\left(100.0, \; \frac{\text{Candidate YOE}}{\text{Required YOE}} \times 100\right)
  \]
- **Education Score**:
  Hierarchy mapping: `Unknown (0)` < `High School (1)` < `Bachelor (2)` < `Master (3)` < `PhD (4)`.
  If candidate degree level \(\ge\) required degree level, score is `100.0`. Otherwise scaled proportionally.
