"""Meeting password hashing.

Uses bcrypt via the ``bcrypt`` package. Meeting passwords are short-lived and
optional; they are hashed with a per-password salt and never exposed by the API.
"""

from __future__ import annotations

import bcrypt

__all__ = ["hash_password", "verify_password"]


def hash_password(password: str) -> str:
    """Return a bcrypt hash of ``password``."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    """True when ``password`` matches ``password_hash``.

    A meeting with no password hash is open; any supplied password is ignored.
    """
    if password_hash is None:
        return True
    return bcrypt.checkpw(
        password.encode("utf-8"), password_hash.encode("utf-8")
    )
