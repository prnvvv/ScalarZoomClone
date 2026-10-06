from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    """Realtime-side configuration.

    This class never creates a database engine. It only exposes the
    ``DATABASE_URL`` value for informational purposes; engine and session
    construction stay owned by ``app.database``.
    """

    def __init__(self) -> None:
        self.app_name: str = os.getenv("APP_NAME", "Scalar Meeting API")
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "sqlite:///./scalar_meeting.db",
        )
        self.frontend_url: str = os.getenv(
            "FRONTEND_URL",
            "http://localhost:3000",
        )
        self.stun_server: str = os.getenv(
            "STUN_SERVER",
            "stun:stun.l.google.com:19302",
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()