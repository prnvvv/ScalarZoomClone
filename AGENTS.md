# AGENTS.md

Working agreement for agents contributing to this repository.

## Project

A Zoom-like video conferencing app built as a monorepo with an independent
`backend/` (FastAPI + WebSocket) and `frontend/` (Next.js + WebRTC).

Media is never sent to the server. The backend handles WebRTC signaling and
realtime meeting state only; audio, video, and screen share travel
browser-to-browser over WebRTC peer connections.

## Roles

Three developers work in parallel and must not collide on files.

| Role | Owns |
|---|---|
| Backend Developer 1 | SQLite, SQLAlchemy database, `User`/`Meeting` models, meeting history, REST APIs, scheduling, seed data |
| Backend Developer 2 (realtime) | WebSocket server, signaling, participant management, presence, host controls, realtime tests |
| Frontend Developer | Next.js, React UI, WebRTC client, WebSocket client, dashboard, meeting room |

## File ownership (Backend Developer 2)

Owned:

```
backend/app/websocket/**
backend/app/models/participant.py
backend/app/schemas/participant.py
backend/app/schemas/websocket.py
backend/app/routers/participants.py
backend/app/services/participant_service.py
backend/tests/test_websocket.py
backend/app/main.py
backend/app/config/**
```

Do not modify (owned by Backend Developer 1):

```
backend/app/database/**
backend/app/models/user.py
backend/app/models/meeting.py
backend/app/models/meeting_history.py
backend/app/schemas/user.py
backend/app/schemas/meeting.py
backend/app/schemas/schedule.py
backend/app/routers/users.py
backend/app/routers/meetings.py
backend/app/routers/schedules.py
backend/app/services/meeting_service.py
backend/app/services/schedule_service.py
backend/app/services/history_service.py
backend/app/seed/**
backend/tests/test_meetings.py
backend/tests/test_schedules.py
```

`frontend/` is owned by the frontend developer. Do not modify it.

## Git rules

These are hard constraints. Violating them breaks the parallel workflow.

### Never push

**Do not run `git push` under any circumstances.** Never push to any branch,
never push tags, never force-push, never run `git push --force-with-lease`.
Pushing is a human decision.

Committing locally is expected and allowed. Pushing is not.

The following are also off-limits without explicit human instruction:

- `git push` (any form, any remote)
- `git commit --amend` (rewrite a commit that already exists; make a new one)
- `git reset --hard` / `git rebase` on shared history
- `git checkout -- .` / `git restore .` (destroys uncommitted work)
- `git clean -fd`
- `git config` changes
- `git commit --no-verify` (never skip hooks)
- Creating empty commits
- `git add -A` or `git add .` (see staging rule below)

### One file per commit

**Every single changed file gets its own commit.**

If three files changed, that is three commits. If the same file is changed
again later, that is another commit. Never bundle unrelated files.

A commit's diff must contain exactly one file. Verify with
`git show --stat HEAD` before finishing.

Staging is explicit, never blanket:

```
git add backend/app/websocket/manager.py
git commit -m "feat: add websocket manager"
```

### Single-line commit messages

**Every commit message must be exactly one line.**

No multi-line messages, no subject/body split, no trailers, no blank lines.
Do not use `-m` more than once.

Format: `type: short lowercase description`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`

```
feat: add participant model
fix: clean websocket disconnects
test: add meeting isolation coverage
```

### Never commit

`node_modules/`, `.next/`, `__pycache__/`, `*.pyc`, `.venv/`, `venv/`,
`.env`, `.env.local`, `*.db`, `*.sqlite3`, coverage output, editor config
(`.DS_Store`, `.idea/`, `.vscode/`), build artifacts.

If a `.gitignore` is missing entries for these, add it — as its own commit.

## Shared contracts

These names are contracts with Backend Developer 1 and the frontend. Do not
rename them, and do not silently change their shape.

### REST

```
GET    /api/meetings/{meeting_id}/participants
POST   /api/meetings/{meeting_id}/participants
DELETE /api/participants/{participant_id}
```

### WebSocket

`WS /ws/meetings/{meeting_id}`

Client sends:

```
join  leave  offer  answer  ice_candidate
media_state  screen_share
mute_participant  remove_participant  end_meeting
```

Server sends:

```
joined  participant_joined  participant_left
offer  answer  ice_candidate
participant_updated  host_action
meeting_state  meeting_ended  error
```

Error events use `{type, code, message}` where `code` is one of
`MEETING_NOT_FOUND`, `MEETING_ENDED`, `NOT_A_PARTICIPANT`, `NOT_HOST`,
`TARGET_NOT_FOUND`, `INVALID_MESSAGE`, `UNAUTHORIZED_ACTION`,
`INTERNAL_ERROR`. Never leak stack traces or internal exception text.

## Realtime architecture rules

### Signaling only

The backend routes SDP and ICE envelopes between clients. It does not create
peer connections, does not implement a media server, and must never receive
video frames, audio streams, or screen video.

Do not modify SDP or inspect it. Forward `payload` untouched.

### Server is authoritative

Never trust the frontend for host status, participant ownership, meeting
membership, target identity, meeting existence, or meeting state. Validate
every one of these server-side.

`is_host` is derived from the meeting's `host_id`, never from a client-declared
value. A client claiming `"is_host": true` is ignored.

### Validate inbound messages

Route every inbound frame through the typed Pydantic models in
`backend/app/schemas/websocket.py`. Do not accept arbitrary JSON, and do not
let a malformed frame crash the server.

### Meeting isolation is mandatory

Events must never cross meeting boundaries. If meeting A holds `A1, A2` and
meeting B holds `B1, B2`, then `A1` never receives `B1` or `B2` events. Scope
every connection lookup by `meeting_id`. Cover this with a test.

### Clean up disconnects

On `WebSocketDisconnect`, remove the connection from the manager, update
participant state, notify remaining participants, and free memory. Never leave
stale connections registered.

## Cross-owner dependencies

Reuse Backend Developer 1's database session, `Meeting` model, `User` model,
and meeting service. Never create a second database engine, a duplicate
`Meeting` or `User` model, or a competing meeting service.

If integration requires a change to a file owned by another developer:

1. Do not edit it.
2. Document the required change and surface it for coordination.
3. Wait for confirmation.

Never quietly alter a shared contract to make local work pass.

## Build and test

```
cd backend
pytest tests/test_websocket.py -v
uvicorn app.main:app --reload
```

Configuration comes from environment variables:

| Variable | Default |
|---|---|
| `DATABASE_URL` | `sqlite:///./scalar_meeting.db` |
| `FRONTEND_URL` | `http://localhost:3000` |
| `STUN_SERVER` | `stun:stun.l.google.com:19302` |

`FRONTEND_URL` accepts a comma-separated list for multiple allowed origins.
CORS must not be left unrestricted outside local development.