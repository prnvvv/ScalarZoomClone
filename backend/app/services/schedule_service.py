"""Scheduled meetings: creation plus the dashboard listings."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.meeting import Meeting, MeetingStatus
from app.schemas.schedule import ScheduleMeetingCreate
from app.services.meeting_service import build_meeting_link, require_host
from app.utils.datetime_utils import calculate_end_time, utc_now
from app.utils.meeting_id import generate_meeting_id
from app.utils.validation import (
    validate_duration,
    validate_future_datetime,
    validate_title,
)

DEFAULT_LIST_LIMIT = 50
RECENT_STATUSES: tuple[MeetingStatus, ...] = (
    MeetingStatus.ACTIVE,
    MeetingStatus.ENDED,
)

__all__ = [
    "DEFAULT_LIST_LIMIT",
    "create_scheduled_meeting",
    "get_upcoming_meetings",
    "get_recent_meetings",
]


def create_scheduled_meeting(
    db: Session, payload: ScheduleMeetingCreate, *, host_id: int
) -> Meeting:
    """Create a meeting that stays ``scheduled`` until its start time."""
    title = validate_title(payload.title)
    duration = validate_duration(payload.duration)
    start_time = validate_future_datetime(payload.start_time)
    host = require_host(db, host_id)
    description = (payload.description or "").strip() or None

    meeting_id = generate_meeting_id(db)
    meeting = Meeting(
        meeting_id=meeting_id,
        host_id=host.id,
        title=title,
        description=description,
        start_time=start_time,
        end_time=calculate_end_time(start_time, duration) if duration else None,
        duration=duration,
        status=MeetingStatus.SCHEDULED,
        meeting_link=build_meeting_link(meeting_id),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_upcoming_meetings(
    db: Session,
    *,
    host_id: int | None = None,
    limit: int = DEFAULT_LIST_LIMIT,
) -> list[Meeting]:
    """Scheduled meetings that have not started yet, soonest first."""
    stmt = select(Meeting).where(
        Meeting.status == MeetingStatus.SCHEDULED,
        Meeting.start_time > utc_now(),
    )
    if host_id is not None:
        stmt = stmt.where(Meeting.host_id == host_id)
    stmt = stmt.order_by(Meeting.start_time.asc()).limit(limit)
    return list(db.scalars(stmt).all())


def get_recent_meetings(
    db: Session,
    *,
    host_id: int | None = None,
    limit: int = DEFAULT_LIST_LIMIT,
) -> list[Meeting]:
    """Meetings under way or already finished, most recently started first.

    Cancelled meetings and meetings that never started are excluded.
    """
    stmt = select(Meeting).where(Meeting.status.in_(RECENT_STATUSES))
    if host_id is not None:
        stmt = stmt.where(Meeting.host_id == host_id)
    stmt = stmt.order_by(Meeting.start_time.desc()).limit(limit)
    return list(db.scalars(stmt).all())
