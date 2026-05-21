@echo off
REM School ERP Development Environment Startup Script
REM This script starts both backend (Django) and frontend (Next.js) servers

echo ============================================================
echo School ERP - Development Environment Startup
echo ============================================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

echo Starting Backend (Django REST API)...
echo ---------------------------------------------------
cd rewrite\backend

REM Set Django settings module
set DJANGO_SETTINGS_MODULE=config.settings.local

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

REM Run migrations
echo Running database migrations...
python manage.py migrate --quiet

REM Start backend server in a new window with Daphne ASGI server (required for WebSocket support)
echo Launching backend on http://localhost:8000
echo API Documentation: http://localhost:8000/api/docs/
echo WebSocket Chat: ws://localhost:8000/ws/chat/
start "School ERP Backend" cmd /k "daphne -b 0.0.0.0 -p 8000 config.asgi:application"

echo.
echo Starting Frontend (Next.js)...
echo ---------------------------------------------------
cd ..\..\rewrite\frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start frontend server in a new window
echo Launching frontend on http://localhost:3000 or http://localhost:3001
start "School ERP Frontend" cmd /k "npm run dev"

echo.
echo ============================================================
echo Both servers are starting...
echo.
echo Backend API: http://localhost:8000/api/
echo API Docs: http://localhost:8000/api/docs/
echo API ReDoc: http://localhost:8000/api/redoc/
echo Frontend: http://localhost:3000 (or 3001 if 3000 is busy)
echo.
echo Press any key to close this window (servers will keep running)
echo ============================================================
pause
