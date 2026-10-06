from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.participant import ParticipantCreate, ParticipantOut
from app.services import participant_service

router = APIRouter(prefix="/api", tags=["participants"])


@router.get(
    "/meetings/{meeting_id}/participants",
    response_model=list[ParticipantOut],
)
def list_meeting_participants(
    meeting_id: str,
    active_only: bool = False,
    db: Session = Depends(get_db),
) -> list[ParticipantOut]:
    """Return persisted participants for a meeting."""
    participants = participant_service.get_meeting_participants(
        db,
        meeting_id,
        active_only=active_only,
    )
    return [ParticipantOut.model_validate(row) for row in participants]


@router.post(
    "/meetings/{meeting_id}/participants",
    response_model=ParticipantOut,
    status_code=status.HTTP_201_CREATED,
)
def add_meeting_participant(
    meeting_id: str,
    payload: ParticipantCreate,
    db: Session = Depends(get_db),
) -> ParticipantOut:
    """Create a participant record for a meeting."""
    participant = participant_service.create_participant(
        db,
        meeting_id=meeting_id,
        display_name=payload.display_name,
        user_id=payload.user_id,
        is_host=False,
    )
    return ParticipantOut.model_validate(participant)


@router.delete(
    "/participants/{participant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_participant(
    participant_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Mark a participant as having left the meeting."""
    participant = participant_service.get_participant(db, participant_id)
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )
    participant_service.mark_participant_left(db, participant_id)