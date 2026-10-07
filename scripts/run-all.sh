#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
BACKEND_DIR="$SCRIPT_DIR/../backend"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"

start_backend() {
  echo "=== Starting Backend ==="
  cd "$BACKEND_DIR"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -r requirements.txt > /dev/null 2>&1
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
}

start_frontend() {
  echo "=== Starting Frontend ==="
  cd "$FRONTEND_DIR"
  if [ ! -d node_modules ]; then
    npm ci > /dev/null 2>&1
  fi
  npm run dev &
  FRONTEND_PID=$!
}

start_backend
start_frontend

echo "Both servers are running."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000 (or http://localhost:3001)"

wait