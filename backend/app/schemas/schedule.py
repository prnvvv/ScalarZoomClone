from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.meeting import MeetingResponse, Title


class ScheduleMeetingCreate(BaseModel):
    title: Title
    description: str | None = Field(default=None, max_length=5000)
    # Timezone-aware ISO 8601 only: naive values are rejected by the DB layer.
    start_time: AwareDatetime
    duration: int = Field(gt=0, le=1440, description="Minutes")


class ScheduleMeetingResponse(MeetingResponse):
    """Same shape as MeetingResponse so the frontend has one meeting type."""
