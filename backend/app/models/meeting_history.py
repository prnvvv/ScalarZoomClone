from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, UTCDateTime

if TYPE_CHECKING:
    from app.models.meeting import Meeting


class MeetingHistory(Base):
    """One summary row per finished meeting; title/host come from Meeting."""

    __tablename__ = "meeting_history"
    __table_args__ = (
        CheckConstraint("duration IS NULL OR duration >= 0", name="ck_history_duration"),
        CheckConstraint("participants_count >= 0", name="ck_history_count"),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at", name="ck_history_time_order"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique + index: at most one history row per meeting, fast lookup.
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="RESTRICT"), unique=True, index=True
    )
    started_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    duration: Mapped[int | None] = mapped_column(Integer, default=None)  # minutes
    participants_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )

    meeting: Mapped[Meeting] = relationship("Meeting", back_populates="history")

    def __repr__(self) -> str:
        return f"<MeetingHistory id={self.id} meeting_id={self.meeting_id}>"
