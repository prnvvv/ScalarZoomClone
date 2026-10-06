"""SQLAlchemy engine, declarative Base and database initialisation."""

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator

DEFAULT_DATABASE_URL = "sqlite:///./data/zoom_clone.db"


def _resolve_database_url() -> str:
    """Use config/settings.py when it exists, then the env var, then default."""
    try:
        from app.config.settings import settings  # type: ignore[import-not-found]

        url = getattr(settings, "DATABASE_URL", None) or getattr(
            settings, "database_url", None
        )
        if url:
            return str(url)
    except ImportError:
        pass
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


DATABASE_URL = _resolve_database_url()
_url = make_url(DATABASE_URL)
_is_sqlite = _url.get_backend_name() == "sqlite"


def _ensure_sqlite_directory() -> None:
    """Create the parent folder of a file-based SQLite database."""
    if _is_sqlite and _url.database and _url.database != ":memory:":
        Path(_url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)


class Base(DeclarativeBase):
    """Single declarative base shared by every model."""


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on SQLite, which drops tzinfo.

    Values are stored as naive UTC and always returned as aware UTC, so the
    REST layer can serialise consistent ISO 8601 strings.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetime not allowed; use timezone-aware UTC.")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


_ensure_sqlite_directory()

engine: Engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:
        # SQLite ignores foreign keys unless enabled per connection.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db() -> None:
    """Create all tables and ensure the demo user exists. Safe to repeat."""
    from sqlalchemy.orm import Session

    import app.models  # noqa: F401  (registers tables on Base.metadata)
    from app.models.user import DEMO_USER_EMAIL, DEMO_USER_ID, DEMO_USER_NAME, User

    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        if db.get(User, DEMO_USER_ID) is None:
            db.add(User(id=DEMO_USER_ID, name=DEMO_USER_NAME, email=DEMO_USER_EMAIL))
            db.commit()
