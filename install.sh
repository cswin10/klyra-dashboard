#!/bin/bash

# Klyra Dashboard Installation Script
# This script installs all dependencies for both frontend and backend

set -e

echo "=========================================="
echo "   Klyra Dashboard Installation Script   "
echo "=========================================="
echo ""

# Check for required tools
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v pip >/dev/null 2>&1 || { echo "pip is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create data directories
echo "[1/4] Creating data directories..."
mkdir -p data/uploads data/chroma

# Install backend dependencies
echo ""
echo "[2/4] Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies
echo ""
echo "[3/4] Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Initialize database and create default admin user
echo ""
echo "[4/4] Initializing database and creating default admin user..."
cd backend
python3 seed.py
cd ..

echo ""
echo "=========================================="
echo "   Installation Complete!                "
echo "=========================================="
echo ""
echo "Default admin credentials:"
echo "  Email: admin@klyra.local"
echo "  Password: admin123"
echo ""
echo "IMPORTANT: Please change the password after first login!"
echo ""
echo "To start the application, run: ./start.sh"
echo ""
