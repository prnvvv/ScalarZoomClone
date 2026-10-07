#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [ ! -d .venv ]; then
  echo "Creating backend virtual environment..."
  python3 -m venv .venv
fi

echo "Activating backend virtual environment..."
# shellcheck source=/dev/null
source .venv/bin/activate

if [ ! -r requirements.txt ]; then
  echo "requirements.txt not found in backend/"
  exit 1
fi

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Starting backend server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000