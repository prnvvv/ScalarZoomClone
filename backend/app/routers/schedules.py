from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Meeting
from app.models.user import DEMO_USER_ID
from app.schemas.schedule import ScheduleMeetingCreate, ScheduleMeetingResponse
from app.services import schedule_service
from app.services.exceptions import InvalidRequestError, MeetingConflictError

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.post(
    "", response_model=ScheduleMeetingResponse, status_code=status.HTTP_201_CREATED
)
def create_schedule(
    payload: ScheduleMeetingCreate, db: Session = Depends(get_db)
) -> Meeting:
    """Schedule a future meeting."""
    try:
        return schedule_service.create_scheduled_meeting(
            db, payload, host_id=DEMO_USER_ID
        )
    except MeetingConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc) or "Conflict") from exc
    except InvalidRequestError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, str(exc) or "Invalid request"
        ) from exc


@router.get("/upcoming", response_model=list[ScheduleMeetingResponse])
def list_upcoming(
    limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db)
) -> list[Meeting]:
    return schedule_service.get_upcoming_meetings(db, host_id=DEMO_USER_ID, limit=limit)


@router.get("/recent", response_model=list[ScheduleMeetingResponse])
def list_recent(
    limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db)
) -> list[Meeting]:
    return schedule_service.get_recent_meetings(db, host_id=DEMO_USER_ID, limit=limit)
