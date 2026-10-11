#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/../backend"

# Prefer Windows Python (python) over WSL python (python3) in Git Bash/Cygwin
PYTHON=""
case "${OSTYPE:-}" in
  msys|cygwin|win32)
    command -v python >/dev/null 2>&1 && PYTHON=python
    ;;
esac
[ -z "$PYTHON" ] && command -v python3 >/dev/null 2>&1 && PYTHON=python3
[ -z "$PYTHON" ] && PYTHON=python

# If a previous venv creation failed half-way, remove it
if [ -d .venv ] && [ ! -f .venv/Scripts/activate ] && [ ! -f .venv/bin/activate ]; then
  echo "Removing incomplete virtual environment..."
  rm -rf .venv
fi

if [ ! -d .venv ]; then
  echo "Creating backend virtual environment with $PYTHON..."
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
