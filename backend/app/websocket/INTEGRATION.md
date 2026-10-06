# BD1 Handoff: Participant needs a user link

**From:** Backend Developer 2 (realtime)
**To:** Backend Developer 1
**Blocks:** host authorization in the WebSocket layer

## The problem

`Participant` has no `user_id` column. The app has no authentication. So a live
WebSocket connection cannot be mapped back to a user, and `Meeting.host_id`
(the authoritative host identity) can never be matched against a connecting
participant.

`app/websocket/meeting_gateway.py:is_host_participant()` currently does:

```python
host_id = get_host_id(meeting)                  # from Meeting.host_id
user_id = getattr(participant, "user_id", None) # always None
if host_id is not None and user_id is not None:
    return int(user_id) == host_id              # never reached
return bool(getattr(participant, "is_host", False))   # always this
```

The first branch is dead code. Host status comes only from
`participant.is_host`, which nothing external ever sets to `True`.

**Consequence:** `mute_participant`, `remove_participant`, and `end_meeting`
are unreachable. `session.is_host` is `False` for every participant that joins
via WebSocket.

## The change

Add `user_id` to `Participant` in `backend/app/models/participant.py`:

```python
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
```

Place it after `meeting_id` and before `display_name`. Add `Integer` to the
existing `sqlalchemy` import if it is not already there.

That is the entire change. No other file needs to edit it.

## Why this is sufficient

`is_host_participant()` already contains the correct comparison:

```python
if host_id is not None and user_id is not None:
    return int(user_id) == host_id
```

Once the column exists, `getattr(participant, "user_id", None)` stops returning
`None`, the branch becomes live, and host status is derived from
`Meeting.host_id` — server-side, never from a client payload.

The fallback (`participant.is_host`) stays as a safety net and can be removed
later.

## What I need from you

1. Add the column above.
2. Confirm the migration is applied (or tell me how migrations are run here —
   I see `backend/migrations/.gitkeep` but no Alembic config).

## What I will do once it lands

1. Remove the `INTEGRATION GAP` comment from `is_host_participant()`.
2. Re-run the suite. The 17 skipped tests should start passing, including the
   host-control cases (`host_mute_and_unauthorized_mute`,
   `host_remove_participant`, `unauthorized_remove_and_end_meeting`).
3. Report the result.

## Files I own that depend on this

```
backend/app/websocket/meeting_gateway.py   is_host_participant()
backend/app/websocket/handler.py           _resolve_participant(), host checks
backend/app/services/participant_service.py set_participant_host()
```

No changes needed in any of them. The column is the whole fix.
