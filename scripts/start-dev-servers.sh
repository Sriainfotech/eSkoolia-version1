#!/bin/bash

# School ERP Development Environment Startup Script
# This script starts both backend (Django) and frontend (Next.js) servers

echo "============================================================"
echo "School ERP - Development Environment Startup"
echo "============================================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Backend (Django REST API)..."
echo "---------------------------------------------------"
cd rewrite/backend

# Set Django settings module
export DJANGO_SETTINGS_MODULE=config.settings.local

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Run migrations
echo "Running database migrations..."
python manage.py migrate --quiet

# Start backend server in background with Daphne ASGI server (required for WebSocket support)
echo "Launching backend on http://localhost:8000"
echo "API Documentation: http://localhost:8000/api/docs/"
echo "WebSocket Chat: ws://localhost:8000/ws/chat/"
daphne -b 0.0.0.0 -p 8000 config.asgi:application &
BACKEND_PID=$!

echo ""
echo "Starting Frontend (Next.js)..."
echo "---------------------------------------------------"
cd ../../rewrite/frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start frontend server in background
echo "Launching frontend on http://localhost:3000"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "Both servers are starting in background..."
echo ""
echo "Backend API: http://localhost:8000/api/"
echo "API Docs: http://localhost:8000/api/docs/"
echo "API ReDoc: http://localhost:8000/api/redoc/"
echo "Frontend: http://localhost:3000"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop servers, run:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo "============================================================"

# Wait for both processes
wait
