#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/../backend"

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
else
  PYTHON=python
fi

if [ ! -d .venv ]; then
  echo "Creating backend virtual environment..."
  "$PYTHON" -m venv .venv
fi

echo "Activating backend virtual environment..."
if [ -f .venv/Scripts/activate ]; then
  source .venv/Scripts/activate
else
  source .venv/bin/activate
fi

if [ ! -r requirements.txt ]; then
  echo "requirements.txt not found in backend/"
  exit 1
fi

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Starting backend server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
