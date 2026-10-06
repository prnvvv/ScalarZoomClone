"""Narrow adapter over Backend Developer 1's meeting domain.

The realtime layer must never duplicate meeting validation or meeting-ending
database logic. Every call into BD1's ``Meeting`` model and
``meeting_service`` is funnelled through this single module so the assumed
integration surface is easy to review and change in one place.

Assumed BD1 surface (coordinate before changing):

    app.models.meeting.Meeting
        id: str
        host_id: int            -> User.id
        is_active / status      -> joinability signal
        ended_at / is_ended     -> termination signal

    app.services.meeting_service
        end_meeting(db, meeting_id) -> Meeting | None
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

ENDED_STATUSES = {"ended", "completed", "cancelled", "canceled"}
UNJOINABLE_STATUSES = {"ended", "completed", "cancelled", "canceled"}


def get_meeting(db: Session, meeting_id: str) -> Any | None:
    from app.models.meeting import Meeting

    return db.get(Meeting, meeting_id)


def meeting_exists(db: Session, meeting_id: str) -> bool:
    return get_meeting(db, meeting_id) is not None


def is_ended(meeting: Any) -> bool:
    ended_at = getattr(meeting, "ended_at", None)
    if ended_at is not None:
        return True

    is_ended_flag = getattr(meeting, "is_ended", None)
    if is_ended_flag is not None:
        return bool(is_ended_flag)

    status = getattr(meeting, "status", None)
    if status is not None:
        return str(status).lower() in ENDED_STATUSES

    is_active = getattr(meeting, "is_active", None)
    if is_active is not None:
        return not bool(is_active)

    return False


def is_joinable(meeting: Any) -> bool:
    status = getattr(meeting, "status", None)
    if status is not None and str(status).lower() in UNJOINABLE_STATUSES:
        return False
    return not is_ended(meeting)


def get_host_id(meeting: Any) -> int | None:
    host_id = getattr(meeting, "host_id", None)
    return int(host_id) if host_id is not None else None


def end_meeting(db: Session, meeting_id: str) -> Any | None:
    """Delegate termination to BD1's meeting service."""
    from app.services import meeting_service

    handler = getattr(meeting_service, "end_meeting", None)
    if callable(handler):
        return handler(db, meeting_id)

    meeting = get_meeting(db, meeting_id)
    if meeting is None:
        return None
    if hasattr(meeting, "is_ended"):
        meeting.is_ended = True
    if hasattr(meeting, "status"):
        meeting.status = "ended"
    db.commit()
    db.refresh(meeting)
    return meeting