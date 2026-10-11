#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(dirname "$0")"
BACKEND_DIR="$SCRIPT_DIR/../backend"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
else
  PYTHON=python
fi

start_backend() {
  echo "=== Starting Backend ==="
  cd "$BACKEND_DIR"
  if [ ! -d .venv ]; then
    echo "Creating backend virtual environment..."
    "$PYTHON" -m venv .venv
  fi
  if [ -f .venv/Scripts/activate ]; then
    source .venv/Scripts/activate
  else
    source .venv/bin/activate
  fi
  pip install -r requirements.txt >/dev/null 2>&1
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
}

start_frontend() {
  echo "=== Starting Frontend ==="
  cd "$FRONTEND_DIR"
  if [ ! -d node_modules ]; then
    npm ci >/dev/null 2>&1
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
