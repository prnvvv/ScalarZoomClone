"""Public meeting id generation.

The public id is a nine-digit numeric string such as ``"849201573"``. It is
shown to users and embedded in URLs; it is never used as a foreign key and is
unrelated to the internal ``Meeting.id`` primary key.
"""

from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.meeting import Meeting
from app.services.exceptions import MeetingConflictError

MEETING_ID_LENGTH = 9
MIN_MEETING_ID = 10 ** (MEETING_ID_LENGTH - 1)
MAX_MEETING_ID = 10**MEETING_ID_LENGTH - 1
MAX_GENERATION_ATTEMPTS = 50

__all__ = ["MEETING_ID_LENGTH", "is_valid_meeting_id", "generate_meeting_id"]


def is_valid_meeting_id(value: object) -> bool:
    """True for a nine-digit string with no leading zero."""
    if not isinstance(value, str) or len(value) != MEETING_ID_LENGTH:
        return False
    return value.isdigit() and not value.startswith("0")


def _is_available(db: Session, candidate: str) -> bool:
    stmt = select(Meeting.id).where(Meeting.meeting_id == candidate).limit(1)
    return db.scalars(stmt).first() is None


def generate_meeting_id(db: Session) -> str:
    """Allocate a random, collision-free public meeting id.

    :raises MeetingConflictError: when no free id is found after repeated
        attempts (probability is negligible; it keeps callers from looping).
    """
    for _ in range(MAX_GENERATION_ATTEMPTS):
        span = MAX_MEETING_ID - MIN_MEETING_ID + 1
        candidate = str(secrets.randbelow(span) + MIN_MEETING_ID)
        if _is_available(db, candidate):
            return candidate
    raise MeetingConflictError("Could not allocate a unique meeting id")
