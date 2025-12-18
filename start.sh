#!/bin/bash

# Klyra Dashboard Startup Script
# This script starts both the backend and frontend servers

set -e

echo "=========================================="
echo "   Klyra Dashboard Startup Script        "
echo "=========================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo "Servers stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if Ollama is running
echo "[1/3] Checking Ollama status..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  ✓ Ollama is running"
else
    echo "  ✗ Warning: Ollama is not running on port 11434"
    echo "    Please start Ollama before using the chat feature"
    echo "    Run: ollama serve"
fi

# Start backend
echo ""
echo "[2/3] Starting backend server..."
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..
echo "  Backend starting on http://localhost:8000"

# Wait for backend to be ready
echo "  Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "  ✓ Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ✗ Backend failed to start"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo ""
echo "[3/3] Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
echo "  Waiting for frontend to be ready..."
sleep 5

echo ""
echo "=========================================="
echo "   Klyra Dashboard is running!           "
echo "=========================================="
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo ""
echo "  Default login:"
echo "    Email: admin@klyra.local"
echo "    Password: admin123"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running
wait
