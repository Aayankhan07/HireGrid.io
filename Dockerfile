# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Build the Next.js app in standalone mode
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install dependencies (layer cache)
COPY frontend/package*.json ./
RUN npm install

# Copy source
COPY frontend/ ./

# Bake public env vars into the Next.js bundle at build time
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=577325640295-b1naue9m911p78fg3dr5te6ur463gn2g.apps.googleusercontent.com

RUN npm run build
# Standalone output lives in /app/frontend/.next/standalone


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Python runtime (FastAPI backend)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# System deps: spacy, pdfplumber, pytesseract, Node.js runtime, nginx, supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tesseract-ocr \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    nginx \
    supervisor \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# ── Pre-download ML models at BUILD time so startup is instant ────────────────
# spaCy English model
RUN python -m spacy download en_core_web_sm
# sentence-transformers model used in core/similarity.py
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2'); print('Model cached.')"

# ── Backend source ────────────────────────────────────────────────────────────
COPY backend/ ./backend/

# ── Next.js standalone frontend ───────────────────────────────────────────────
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend-server/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend-server/.next/static/
COPY --from=frontend-builder /app/frontend/public ./frontend-server/public/

# ── Nginx reverse proxy config ────────────────────────────────────────────────
# Port 7860 is the single port Hugging Face Spaces exposes.
# /api/* → FastAPI (127.0.0.1:8000)
# /*     → Next.js (127.0.0.1:3000)
RUN cat > /etc/nginx/sites-available/default << 'EOF'
upstream fastapi {
server 127.0.0.1:8000;
}
upstream nextjs {
server 127.0.0.1:3000;
}

server {
listen 7860;
server_name _;
client_max_body_size 100M;

location /api/ {
proxy_pass http://fastapi;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
proxy_connect_timeout 10s;
}

location / {
proxy_pass http://nextjs;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_connect_timeout 10s;
proxy_read_timeout 60s;
}
}
EOF

# ── Startup script: wait for both services before starting nginx ──────────────
RUN cat > /app/wait-and-start.sh << 'EOF'
#!/bin/bash
set -e

echo "[startup] Waiting for FastAPI on :8000..."
for i in $(seq 1 60); do
curl -sf http://127.0.0.1:8000/ > /dev/null 2>&1 && echo "[startup] FastAPI is up!" && break
sleep 2
done

echo "[startup] Waiting for Next.js on :3000..."
for i in $(seq 1 60); do
curl -sf http://127.0.0.1:3000/ > /dev/null 2>&1 && echo "[startup] Next.js is up!" && break
sleep 2
done

echo "[startup] Starting nginx..."
nginx -g "daemon off;"
EOF
RUN chmod +x /app/wait-and-start.sh

# ── Supervisor config to manage all three processes ───────────────────────────
RUN cat > /etc/supervisor/conf.d/hiregrid.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log

[program:fastapi]
command=uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1
directory=/app/backend
autostart=true
autorestart=true
startretries=3
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nextjs]
command=node server.js
directory=/app/frontend-server
environment=PORT=3000,NODE_ENV=production,HOSTNAME=127.0.0.1
autostart=true
autorestart=true
startretries=3
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=/app/wait-and-start.sh
autostart=true
autorestart=false
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

EXPOSE 7860

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]


