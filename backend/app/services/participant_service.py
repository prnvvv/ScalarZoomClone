from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.participant import Participant


class ParticipantNotFoundError(Exception):
    """Raised when a participant row does not exist."""


def create_participant(
    db: Session,
    *,
    meeting_id: int,
    display_name: str,
    is_host: bool = False,
) -> Participant:
    """Create a participant row.

    ``meeting_id`` is the internal ``meetings.id`` primary key, not the public
    meeting id string. Resolve it with
    ``app.websocket.meeting_gateway.get_meeting`` first.
    """
    participant = Participant(
        meeting_id=meeting_id,
        display_name=display_name,
        is_host=is_host,
        is_muted=False,
        is_video_on=True,
        screen_share=False,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def get_participant(db: Session, participant_id: int) -> Participant | None:
    return db.get(Participant, participant_id)


def require_participant(db: Session, participant_id: int) -> Participant:
    participant = get_participant(db, participant_id)
    if participant is None:
        raise ParticipantNotFoundError(f"Participant {participant_id} not found")
    return participant


def get_meeting_participants(
    db: Session,
    meeting_id: int,
    *,
    active_only: bool = False,
) -> list[Participant]:
    stmt = select(Participant).where(Participant.meeting_id == meeting_id)
    if active_only:
        stmt = stmt.where(Participant.left_at.is_(None))
    stmt = stmt.order_by(Participant.id.asc())
    return list(db.scalars(stmt).all())


def update_participant_state(
    db: Session,
    participant_id: int,
    *,
    is_muted: bool | None = None,
    is_video_on: bool | None = None,
    screen_share: bool | None = None,
    display_name: str | None = None,
) -> Participant:
    participant = require_participant(db, participant_id)
    if is_muted is not None:
        participant.is_muted = is_muted
    if is_video_on is not None:
        participant.is_video_on = is_video_on
    if screen_share is not None:
        participant.screen_share = screen_share
    if display_name is not None:
        participant.display_name = display_name
    db.commit()
    db.refresh(participant)
    return participant


def set_participant_host(db: Session, participant_id: int, is_host: bool) -> Participant:
    """Mirror ``Meeting.host_id`` onto the participant's convenience flag.

    The meeting's ``host_id`` stays authoritative; this only keeps the
    broadcast field in sync with it.
    """
    participant = require_participant(db, participant_id)
    participant.is_host = is_host
    db.commit()
    db.refresh(participant)
    return participant


def mark_participant_left(db: Session, participant_id: int) -> Participant | None:
    """Record a graceful or unexpected departure. Idempotent."""
    participant = get_participant(db, participant_id)
    if participant is None:
        return None
    if participant.left_at is None:
        participant.left_at = datetime.now(timezone.utc)
        participant.screen_share = False
        db.commit()
        db.refresh(participant)
    return participant


def mark_participant_removed(db: Session, participant_id: int) -> Participant | None:
    """Mark a participant as removed by the host."""
    participant = get_participant(db, participant_id)
    if participant is None:
        return None
    participant.left_at = datetime.now(timezone.utc)
    participant.screen_share = False
    db.commit()
    db.refresh(participant)
    return participant