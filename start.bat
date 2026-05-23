@echo off
echo ==============================================
echo  HireGrid.io -- AI Resume Screener
echo ==============================================
echo.

echo [1/4] Setting up Python virtual environment...
cd /d "%~dp0backend"
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate

echo [2/4] Installing Python dependencies...
pip install -r requirements.txt
python -m spacy download en_core_web_sm

echo [3/4] Setting up React frontend dependencies...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo [3/4] node_modules not found, running npm install...
    call npm install
) else (
    echo [3/4] node_modules already exists, skipping installation.
)

echo [4/4] Starting backend and frontend services...
echo.
echo Starting FastAPI backend on port 8000...
start "HireGrid.io Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate && uvicorn app:app --reload --port 8000 --host 0.0.0.0"

echo Starting React Next.js frontend...
start "HireGrid.io Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==============================================
echo  Both services starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  API Docs: http://localhost:8000/docs
echo ==============================================
timeout /t 5


