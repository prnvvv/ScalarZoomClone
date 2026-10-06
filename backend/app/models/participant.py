from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.meeting import Meeting


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Participant(Base):
    """A persisted participant record for a meeting.

    Only durable fields live here. Transient realtime connection state
    (JOINING / RECONNECTING / DISCONNECTED / REMOVED) is kept in memory by
    ``app.websocket.manager`` and is intentionally not forced into SQLite.

    Relationship keys:
      * ``meeting_id`` -> Meeting.id
      * ``user_id``    -> User.id (optional; anonymous guests stay NULL)
    """

    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meeting_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_host: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_video_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    meeting: Mapped["Meeting"] = relationship("Meeting", foreign_keys=[meeting_id])

    @property
    def is_active(self) -> bool:
        return self.left_at is None

    def to_summary(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "is_host": self.is_host,
            "is_muted": self.is_muted,
            "is_video_on": self.is_video_on,
        }