from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.meeting import MeetingStatus

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
DisplayName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class MeetingCreate(BaseModel):
    title: Title
    description: str | None = Field(default=None, max_length=5000)


class MeetingJoinRequest(BaseModel):
    display_name: DisplayName


class MeetingResponse(BaseModel):
    """Mirrors the Meeting model exactly."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: str
    host_id: int
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime | None
    duration: int | None
    status: MeetingStatus
    meeting_link: str
    created_at: datetime
