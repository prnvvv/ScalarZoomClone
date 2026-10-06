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
    meeting_id: str,
    display_name: str,
    user_id: int | None = None,
    is_host: bool = False,
) -> Participant:
    participant = Participant(
        meeting_id=meeting_id,
        user_id=user_id,
        display_name=display_name,
        is_host=is_host,
        is_muted=False,
        is_video_on=True,
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
    meeting_id: str,
    *,
    active_only: bool = False,
) -> list[Participant]:
    stmt = select(Participant).where(Participant.meeting_id == meeting_id)
    if active_only:
        stmt = stmt.where(Participant.left_at.is_(None))
    stmt = stmt.order_by(Participant.joined_at.asc(), Participant.id.asc())
    return list(db.scalars(stmt).all())


def update_participant_state(
    db: Session,
    participant_id: int,
    *,
    is_muted: bool | None = None,
    is_video_on: bool | None = None,
    display_name: str | None = None,
) -> Participant:
    participant = require_participant(db, participant_id)
    if is_muted is not None:
        participant.is_muted = is_muted
    if is_video_on is not None:
        participant.is_video_on = is_video_on
    if display_name is not None:
        participant.display_name = display_name
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
        db.commit()
        db.refresh(participant)
    return participant


def mark_participant_removed(db: Session, participant_id: int) -> Participant | None:
    """Mark a participant as kicked by the host."""
    participant = get_participant(db, participant_id)
    if participant is None:
        return None
    participant.left_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(participant)
    return participant