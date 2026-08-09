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

| Variable Name | Default / Example | Purpose |
|---|---|---|
| `ENV` | `development` | Environment mode (`development` / `production`) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowed origin list |
| `ALLOW_DEV_BYPASS` | `true` | Allows mock Google OAuth login bypass in local dev |
| `JWT_SECRET` | `super-secret-key-hiregrid-12345` | Cryptographic secret for signing session tokens |
| `ADMIN_EMAIL` | `admin@hiregrid.io` | Seed administrator account email |
| `ADMIN_PASSWORD` | `password123` | Seed administrator account password |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `5773...apps.googleusercontent.com` | Google OAuth 2.0 Client ID for frontend button |
| `DATABASE_URL` | `sqlite:///hiregrid.db` | SQL connection string (`sqlite` or `postgresql://...`) |

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

# Download spaCy English model
python -m spacy download en_core_web_sm

# Launch Uvicorn dev server on port 8000
uvicorn app:app --reload --port 8000
```

The backend server will start at `http://localhost:8000` (OpenAPI Swagger UI docs available at `http://localhost:8000/docs`).

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
# Build Docker image
docker build -t hiregrid.io:latest .

# Run Docker container mapping port 7860
docker run -d -p 7860:7860 --name hiregrid_app hiregrid.io:latest
```

Access the unified application in browser at `http://localhost:7860`.

---

## ☁️ Hugging Face Spaces & Cloud Deployment

The repository is pre-configured for deployment on **Hugging Face Spaces** (Docker SDK):

1. **Create Space**: Create a new Docker Space on Hugging Face.
2. **Port Expose**: Hugging Face Spaces exposes port `7860`. The included `Dockerfile` configures Nginx to listen on port `7860`:
   - Requests to `/api/*` are reverse-proxied to FastAPI (`127.0.0.1:8000`).
   - Requests to `/*` are reverse-proxied to Next.js (`127.0.0.1:3000`).
3. **Environment Secrets**: Add production secrets (`JWT_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ALLOW_DEV_BYPASS=false`) under the Space **Settings \(\rightarrow\) Repository Secrets**.
4. **Push Repository**: Push the code to Hugging Face Git remote; the container will build and start automatically.
