# Backend container for Cloud Run / GCP.
# Build context: repository root (so backend/ is available).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install build dependencies for psycopg2-binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/data ./data

# Cloud Run sets PORT; default to 8000 for local Docker runs.
ENV PORT=8000
EXPOSE $PORT

# Bind to 0.0.0.0 so Cloud Run can route traffic into the container.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
