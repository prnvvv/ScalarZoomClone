from app.websocket.manager import Connection, ConnectionManager, get_manager

__all__ = [
    "Connection",
    "ConnectionManager",
    "get_manager",
    "websocket_router",
]


def __getattr__(name: str):
    """Resolve the handler's router lazily.

    ``app.websocket.handler`` imports Backend Developer 1's ``get_db`` at module
    scope. Importing it eagerly would make ``app.websocket.manager`` unusable
    until those modules exist, so it is deferred to first access.
    """
    if name == "websocket_router":
        from app.websocket.handler import router

        return router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")