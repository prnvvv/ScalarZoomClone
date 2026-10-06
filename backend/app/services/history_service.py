"""Durable meeting history: one row per meeting that actually started."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.meeting import Meeting
from app.models.meeting_history import MeetingHistory
from app.models.participant import Participant
from app.utils.datetime_utils import ensure_aware, minutes_between, utc_now

DEFAULT_RECENT_LIMIT = 20

__all__ = [
    "get_history",
    "get_recent_history",
    "count_participants",
    "record_meeting_start",
    "record_meeting_end",
]


def get_history(db: Session, meeting: Meeting) -> MeetingHistory | None:
    """History row for a meeting, or ``None`` while it has not started."""
    stmt = select(MeetingHistory).where(MeetingHistory.meeting_id == meeting.id)
    return db.scalars(stmt).first()


def count_participants(db: Session, meeting: Meeting) -> int:
    """Every participant row for the meeting, including those who left."""
    stmt = select(func.count()).select_from(Participant).where(
        Participant.meeting_id == meeting.id
    )
    return int(db.scalar(stmt) or 0)


def record_meeting_start(db: Session, meeting: Meeting) -> MeetingHistory:
    """Open the history row when a meeting starts. Safe to repeat."""
    existing = get_history(db, meeting)
    if existing is not None:
        return existing

    history = MeetingHistory(
        meeting_id=meeting.id,
        started_at=ensure_aware(meeting.start_time),
        participants_count=0,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def record_meeting_end(
    db: Session,
    meeting: Meeting,
    *,
    ended_at: datetime | None = None,
    participants_count: int | None = None,
) -> MeetingHistory:
    """Close the history row with duration and participant count.

    Commits the session, so pending edits to ``meeting`` (status, end time)
    are persisted together with the history row.
    """
    history = record_meeting_start(db, meeting)

    end = ensure_aware(ended_at or utc_now())
    if end < history.started_at:
        # Keep the meeting_history "ended_at >= started_at" CHECK satisfied.
        end = history.started_at

    history.ended_at = end
    history.duration = minutes_between(history.started_at, end)
    history.participants_count = (
        count_participants(db, meeting)
        if participants_count is None
        else participants_count
    )
    db.commit()
    db.refresh(history)
    return history


def get_recent_history(db: Session, *, limit: int = DEFAULT_RECENT_LIMIT) -> list[MeetingHistory]:
    """Finished meetings, most recently ended first."""
    stmt = (
        select(MeetingHistory)
        .where(MeetingHistory.ended_at.is_not(None))
        .order_by(MeetingHistory.ended_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())
