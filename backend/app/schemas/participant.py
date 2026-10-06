from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ParticipantBase(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    is_muted: bool = False
    is_video_on: bool = True


class ParticipantCreate(ParticipantBase):
    """Payload for creating a participant.

    ``user_id`` is deliberately absent: ``Participant`` has no user link, so
    there is nothing for a client to supply. Host status is derived
    server-side from ``Meeting.host_id``.
    """


class ParticipantUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_muted: bool | None = None
    is_video_on: bool | None = None


class ParticipantOut(ParticipantBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Internal meetings.id (the Participant FK), not the public meeting id.
    meeting_id: int
    # Participant has no user column yet; kept for contract compatibility.
    user_id: int | None = None
    is_host: bool
    joined_at: datetime | None = None
    left_at: datetime | None = None


class ParticipantSummary(BaseModel):
    """Shape broadcast to clients on join/join notifications."""

    id: int
    display_name: str
    is_host: bool
    is_muted: bool
    is_video_on: bool
    screen_share: bool = False