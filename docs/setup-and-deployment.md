# Setup & Deployment Guide — HireGrid.io

This document provides instructions for local development environment setup, configuration management, multi-stage Docker containerization, and production cloud deployment (Hugging Face Spaces, Docker host, cloud VM) for **HireGrid.io**.

---

## 📋 System Requirements

| Component | Minimum Version Requirement |
|---|---|
| **Python** | Python 3.11+ |
| **Node.js** | Node.js v20.x LTS |
| **Package Managers** | `pip` (Python), `npm` (Node) |
| **Docker** | Docker Engine 24.0+ & Docker Compose (Optional) |
| **OS Support** | Linux (Ubuntu/Debian), macOS, Windows 10/11 (WSL2 or PowerShell) |

---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the root project directory (copied from `.env.example`):

```bash
cp .env.example .env
```

### Environment Variables Matrix

#### Security

| Variable | Default | Purpose |
|---|---|---|
| `ENV` | `development` | `development` / `production`. Production enables the hard checks below. |
| `JWT_SECRET` | *(none)* | Signing key for session tokens. **Required in production** — startup fails without it. Outside production a random per-process key is generated and sessions do not survive a restart. |
| `ALLOW_DEV_BYPASS` | `false` | Enables the mock Google login bypass. Ignored entirely when `ENV=production`. |
| `ADMIN_EMAIL` | `admin@hiregrid.io` | Seed administrator email. |
| `ADMIN_PASSWORD` | *(none)* | Seed administrator password. If empty: random + logged once in development, admin seed skipped in production. Setting it to `password123` is refused in production. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins. `*` is rejected (incompatible with credentialed requests) and falls back to localhost. |
| `LOGIN_MAX_ATTEMPTS` | `10` | Failed logins allowed per window, per IP + email. |
| `LOGIN_WINDOW_SECONDS` | `300` | Throttling window length. |

> **Generate a secret:**
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

#### Application

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(unset → SQLite)* | Leave empty for `backend/hiregrid.db`; set `postgresql://user:pass@host/db?sslmode=require` for Postgres. |
| `DB_POOL_MAX` | `10` | Postgres connection pool ceiling. Unused for SQLite. |
| `MAX_RESUME_BYTES` | `15728640` | Per-file upload cap (15MB). |
| `BACKEND_URL` | `http://localhost:8000` | Backend origin for the Next.js `/api` rewrite. Not needed in the Docker image (nginx routes `/api` itself); required for split deployments. |
| `PORT` | `8000` | Port bound when running `python app.py` directly. Ignored when launched via `uvicorn`, which takes `--port`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(none)* | Google OAuth client ID. **Baked in at build time** — see the Docker section. |

#### Embedding model (advanced)

| Variable | Default | Purpose |
|---|---|---|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer used for semantic matching. Must be a key in `MODEL_REGISTRY` (`backend/core/similarity.py`) to get correct calibration. |

The model carries **40% of the composite score**, so this is the
highest-leverage setting in the system. Registered options, each with its own
calibration band and query prefix:

- `all-MiniLM-L6-v2` (default)
- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-base-en-v1.5`
- `sentence-transformers/all-mpnet-base-v2`

> **Do not swap on benchmark reputation.** Measured on this repo's suite,
> `bge-small` scored *worse* despite ranking higher on MTEB — it compressed the
> usable score range and mis-ordered a candidate pair. Always run
> `python accuracy_checker/compare_models.py` first and judge on NDCG and
> Kendall tau. An unregistered model still loads but logs a warning, because its
> calibration is a guess.

#### Scoring calibration (advanced)

Defaults come from the active model's registry entry; set these only to
override. Heuristic, not fitted to labelled data. See
[Scoring Engine](scoring-engine-and-nlp.md).

| Variable | Default | Purpose |
|---|---|---|
| `SEMANTIC_FLOOR` / `SEMANTIC_CEILING` | `15.0` / `65.0` | Cosine band stretched onto 0–100 for JD matching (MiniLM values). |
| `SKILL_FLOOR` / `SKILL_CEILING` | `15.0` / `70.0` | Same, for dense skill-token matching. |
| `CHUNK_MAX_WEIGHT` | `0.7` | How much the best-matching resume section counts versus the mean across sections. `1.0` = pure max, `0.0` = pure mean. |
| `AUTO_REJECT_SKILL_SIM` | `10.0` | Skill-similarity threshold for the relevance floor. |
| `AUTO_REJECT_SEMANTIC` | `20.0` | Semantic threshold. Both must be breached to auto-reject. |

---

## 🚀 Production Deployment Checklist

Setting `ENV=production` turns the first three into enforced startup checks:

- [ ] `ENV=production`
- [ ] `JWT_SECRET` set to a freshly generated random value
- [ ] `ADMIN_PASSWORD` either unset (no admin seeded) or a real password
- [ ] `ALLOW_DEV_BYPASS=false` (belt and braces — production ignores it anyway)
- [ ] `ALLOWED_ORIGINS` restricted to your real frontend origin
- [ ] `DATABASE_URL` pointing at PostgreSQL — SQLite serialises writes and is not
      suitable for concurrent use
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` passed as a **build argument**
- [ ] Persistent volume mounted for `backend/uploads/` (resume PDFs)
- [ ] A gateway-level rate limiter in front if running more than one worker —
      the built-in throttle is per-process

---

## 💻 Local Development Setup

### 1. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# Install dependencies & CPU PyTorch
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# Launch Uvicorn dev server on port 8000
uvicorn app:app --reload --port 8000
```

The backend starts at `http://localhost:8000` (OpenAPI docs at
`http://localhost:8000/docs`). The first run downloads the
`all-MiniLM-L6-v2` sentence-transformer model (~90MB) and caches it.

> The `en_core_web_sm` spaCy model is **no longer required** — extraction is
> entirely rule-based. See [Scoring Engine](scoring-engine-and-nlp.md).

### Running the tests

```bash
cd backend
python -m pytest tests/ -q            # 56 tests
```

```bash
# Scoring regression benchmark (from the repository root)
python accuracy_checker/evaluator.py --min-ndcg 0.9
```

---

### 2. Frontend Setup (Next.js 16)

Open a second terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server on port 3000
npm run dev
```

The frontend application will start at `http://localhost:3000`.

---

## 🐳 Docker Multi-Stage Containerization

HireGrid.io provides a single-container multi-stage Docker build combining Next.js 16 standalone frontend server, Uvicorn FastAPI backend, and Nginx reverse proxy managed by Supervisor.

### Building & Running with Docker

```bash
# Build. Two things are baked in at BUILD time:
#   - the Google client ID, which is compiled into the frontend bundle
#   - the embedding model, pre-downloaded so the container starts instantly
docker build \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com \
  --build-arg EMBEDDING_MODEL=all-MiniLM-L6-v2 \
  -t hiregrid.io:latest .

# Run, passing runtime secrets and persisting uploaded resumes.
docker run -d -p 7860:7860 \
  -e ENV=production \
  -e JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" \
  -e DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" \
  -e ALLOWED_ORIGINS="https://your-domain.com" \
  -v hiregrid_uploads:/app/backend/uploads \
  --name hiregrid_app hiregrid.io:latest
```

Access the unified application at `http://localhost:7860`.

> **Uploads are ephemeral without a volume.** Resume PDFs live on the container
> filesystem; without the `-v` mount they are lost on every redeploy and CV
> downloads will 404 for previously screened candidates.

> **Keep `EMBEDDING_MODEL` consistent.** The build argument decides which model
> is baked into the image. Setting a *different* model as a runtime environment
> variable makes the container download it on first request — slow, and it will
> fail entirely in an offline environment.

---

## ☁️ Hugging Face Spaces & Cloud Deployment

The repository is pre-configured for deployment on **Hugging Face Spaces** (Docker SDK):

1. **Create Space**: Create a new Docker Space on Hugging Face.
2. **Port Expose**: Hugging Face Spaces exposes port `7860`. The included `Dockerfile` configures Nginx to listen on port `7860`:
   - Requests to `/api/*` are reverse-proxied to FastAPI (`127.0.0.1:8000`).
   - Requests to `/*` are reverse-proxied to Next.js (`127.0.0.1:3000`).
3. **Environment Secrets**: Add production secrets (`JWT_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ALLOW_DEV_BYPASS=false`) under the Space **Settings \(\rightarrow\) Repository Secrets**.
4. **Push Repository**: Push the code to Hugging Face Git remote; the container will build and start automatically.
