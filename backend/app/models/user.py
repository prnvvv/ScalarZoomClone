from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base, UTCDateTime, utc_now

if TYPE_CHECKING:
    from app.models.meeting import Meeting

DEMO_USER_ID = 1
DEMO_USER_NAME = "Demo User"
DEMO_USER_EMAIL = "demo@example.com"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # unique=True already creates the index used for email lookups.
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    # No delete cascade: removing a user must never silently remove meetings.
    meetings: Mapped[list[Meeting]] = relationship(
        "Meeting", back_populates="host", foreign_keys="Meeting.host_id"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
