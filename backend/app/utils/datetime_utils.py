"""Timezone-safe datetime helpers.

Every helper normalises naive input to UTC so callers never hit
``TypeError: can't compare offset-naive and offset-aware datetimes``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from app.database.database import utc_now
from app.models.meeting import MeetingStatus

if TYPE_CHECKING:
    from app.models.meeting import Meeting

__all__ = [
    "utc_now",
    "ensure_aware",
    "is_future",
    "is_past",
    "is_upcoming",
    "has_ended",
    "calculate_end_time",
    "minutes_between",
]


def ensure_aware(value: datetime, *, assume_tz: timezone = timezone.utc) -> datetime:
    """Return a UTC-aware datetime, assuming ``assume_tz`` for naive input."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=assume_tz)
    return value.astimezone(timezone.utc)


def _now(now: datetime | None) -> datetime:
    return utc_now() if now is None else ensure_aware(now)


def is_future(value: datetime, *, now: datetime | None = None) -> bool:
    """True when ``value`` lies strictly after ``now``."""
    return ensure_aware(value) > _now(now)


def is_past(value: datetime, *, now: datetime | None = None) -> bool:
    """True when ``value`` lies strictly before ``now``."""
    return ensure_aware(value) < _now(now)


def is_upcoming(meeting: Meeting, *, now: datetime | None = None) -> bool:
    """True while a scheduled meeting is still waiting for its start time."""
    if meeting.status is not MeetingStatus.SCHEDULED:
        return False
    return ensure_aware(meeting.start_time) > _now(now)


def has_ended(meeting: Meeting, *, now: datetime | None = None) -> bool:
    """True for terminal meetings, or a live meeting past its ``end_time``."""
    if meeting.status in (MeetingStatus.ENDED, MeetingStatus.CANCELLED):
        return True
    if meeting.end_time is None:
        return False
    return ensure_aware(meeting.end_time) <= _now(now)


def calculate_end_time(start_time: datetime, duration_minutes: int) -> datetime:
    """End time for a meeting of ``duration_minutes`` from ``start_time``."""
    return ensure_aware(start_time) + timedelta(minutes=duration_minutes)


def minutes_between(start_time: datetime, end_time: datetime) -> int:
    """Whole minutes from start to end, clamped at zero."""
    delta = ensure_aware(end_time) - ensure_aware(start_time)
    return max(0, int(delta.total_seconds() // 60))
