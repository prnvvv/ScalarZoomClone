"""Session factory and FastAPI dependency."""

from collections.abc import Generator

from sqlalchemy.orm import Session, sessionmaker

from app.database.database import engine

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


def get_db() -> Generator[Session, None, None]:
    """Yield a session; roll back on error and always close."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
