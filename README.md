# Scalar Zoom Clone

A collaborative, Zoom-style video conferencing platform: Next.js frontend,
FastAPI backend, SQLite persistence, WebSocket signaling and WebRTC peer-to-peer
media.

## Layout

```text
frontend/   Next.js UI (dashboard, meetings, meeting room, WebRTC client)
backend/    FastAPI API, SQLite database, WebSocket signaling
AGENTS.md   Repository-wide instructions for contributors and coding agents
```

## Quick start

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The SQLite schema and demo user are created on startup. API docs at
<http://localhost:8000/docs>.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

See `backend/README.md` for the API surface and `frontend/README.md` for the UI.

## Configuration

Copy `.env.example` (root), `backend/.env.example` and
`frontend/.env.local.example`, then export the values — nothing loads `.env`
files automatically.

## How it works

- **REST** handles persistent CRUD and business rules (meetings, schedules, users).
- **WebSocket** (`/ws/meetings/{meeting_id}`) carries signaling and participant state.
- **WebRTC** carries audio, video and screen sharing directly between peers; media
  never passes through the server.
- **SQLite** stores users, meetings, participants and meeting history in
  `backend/data/zoom_clone.db`.

## Meetings

Public meeting ids are nine-digit numbers generated server-side (e.g.
`839452761`). Lifecycle: `scheduled → active → ended`, with `scheduled →
cancelled` as the alternative. History is preserved when a meeting ends.
