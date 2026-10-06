"""Meeting service, utils and seed tests (Backend Developer 2).

Run from the ``backend`` directory::

    pytest tests/test_meetings.py -v

The suite uses its own in-memory SQLite database, so it never touches the
development ``backend/data`` file and needs no async plugin.
"""

from __future__ import annotations

import os
import tempfile
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import order matters: the URL must be set before app.database is imported.
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.gettempdir(), 'zoom_p2_meetings.db')}"

from app.database.database import Base, init_db  # noqa: E402
from app.database.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.meeting import Meeting, MeetingStatus  # noqa: E402
from app.models.meeting_history import MeetingHistory  # noqa: E402
from app.models.user import (  # noqa: E402
    DEMO_USER_EMAIL,
    DEMO_USER_ID,
    DEMO_USER_NAME,
    User,
)
from app.schemas.meeting import MeetingCreate  # noqa: E402
from app.seed.seed_data import run_seed, seed_demo_user  # noqa: E402
from app.services import history_service, meeting_service  # noqa: E402
from app.services.exceptions import (  # noqa: E402
    InvalidRequestError,
    MeetingConflictError,
    MeetingNotFoundError,
)
from app.utils.datetime_utils import (  # noqa: E402
    calculate_end_time,
    ensure_aware,
    has_ended,
    is_future,
    is_past,
    is_upcoming,
    minutes_between,
    utc_now,
)
from app.utils.meeting_id import (  # noqa: E402
    generate_meeting_id,
    is_valid_meeting_id,
)
from app.utils.validation import (  # noqa: E402
    validate_display_name,
    validate_duration,
    validate_future_datetime,
    validate_host,
    validate_meeting_id,
    validate_meeting_state,
    validate_title,
)


# --------------------------------------------------------------------------
# Fixtures: isolated in-memory SQLite per test
# --------------------------------------------------------------------------


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )
    with TestingSession() as session:
        session.add(
            User(id=DEMO_USER_ID, name=DEMO_USER_NAME, email=DEMO_USER_EMAIL)
        )
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture()
def client(db):
    app = create_app()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def meeting(db):
    return meeting_service.create_meeting(
        db, MeetingCreate(title="Standup"), host_id=DEMO_USER_ID
    )


def _make_scheduled(db, *, title, start_offset, duration):
    """Create a scheduled meeting, optionally with a shifted clock window."""
    from app.services import schedule_service
    from app.schemas.schedule import ScheduleMeetingCreate

    created = schedule_service.create_scheduled_meeting(
        db,
        ScheduleMeetingCreate(
            title=title,
            start_time=utc_now() + start_offset,
            duration=duration,
        ),
        host_id=DEMO_USER_ID,
    )
    return created


def _shift_window(db, target: Meeting, *, start_offset, duration):
    """Move a meeting's window into the past to simulate elapsed time."""
    target.start_time = utc_now() + start_offset
    target.end_time = calculate_end_time(target.start_time, duration)
    db.commit()
    db.refresh(target)
    return target


# --------------------------------------------------------------------------
# Public meeting id utility
# --------------------------------------------------------------------------


def test_generated_meeting_ids_are_nine_digits_and_unique(db):
    ids = {generate_meeting_id(db) for _ in range(500)}

    assert len(ids) == 500
    assert all(is_valid_meeting_id(value) for value in ids)
    assert all(len(value) == 9 and value.isdigit() for value in ids)


def test_generated_meeting_ids_are_not_sequential(db):
    ids = [int(generate_meeting_id(db)) for _ in range(200)]

    assert max(ids) - min(ids) > 100_000
    assert ids != sorted(ids)


def test_is_valid_meeting_id_rejects_malformed_values():
    assert is_valid_meeting_id("849201573") is True
    for value in ("84920157", "8492015730", "012345678", "abcdefghi", "", None, 849201573):
        assert is_valid_meeting_id(value) is False


def test_generated_meeting_id_does_not_collide_with_existing_row(db, meeting):
    for _ in range(50):
        assert generate_meeting_id(db) != meeting.meeting_id


# --------------------------------------------------------------------------
# Datetime utilities
# --------------------------------------------------------------------------


def test_ensure_aware_treats_naive_input_as_utc():
    from datetime import datetime, timezone

    naive = datetime(2026, 1, 1, 12, 0)
    aware = ensure_aware(naive)

    assert aware.tzinfo is not None
    assert aware == datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def test_future_and_past_helpers_never_raise_on_naive_input():
    naive_future = (utc_now() + timedelta(days=1)).replace(tzinfo=None)
    naive_past = (utc_now() - timedelta(days=1)).replace(tzinfo=None)

    assert is_future(naive_future) is True
    assert is_future(naive_past) is False
    assert is_past(naive_past) is True
    assert is_past(naive_future) is False


def test_calculate_end_time_and_minutes_between():
    start = utc_now()

    assert calculate_end_time(start, 45) == start + timedelta(minutes=45)
    assert minutes_between(start, start + timedelta(minutes=45)) == 45
    assert minutes_between(start + timedelta(minutes=45), start) == 0


def test_upcoming_and_ended_checks_use_status_and_window(db, meeting):
    assert is_upcoming(meeting) is False  # instant meetings are active
    assert has_ended(meeting) is False

    meeting.status = MeetingStatus.ENDED
    assert has_ended(meeting) is True

    meeting.status = MeetingStatus.CANCELLED
    assert has_ended(meeting) is True

    meeting.status = MeetingStatus.ACTIVE
    meeting.end_time = utc_now() - timedelta(minutes=1)
    assert has_ended(meeting) is True

    meeting.end_time = utc_now() + timedelta(minutes=30)
    assert has_ended(meeting) is False


def test_is_upcoming_only_true_for_scheduled_future_meetings(db):
    scheduled = _make_scheduled(
        db, title="Later", start_offset=timedelta(days=1), duration=30
    )

    assert is_upcoming(scheduled) is True
    assert is_upcoming(_shift_window(db, scheduled, start_offset=-timedelta(hours=1), duration=30)) is False


# --------------------------------------------------------------------------
# Validation helpers
# --------------------------------------------------------------------------


def test_validate_meeting_id_accepts_public_ids_only():
    assert validate_meeting_id("849201573") == "849201573"
    with pytest.raises(InvalidRequestError):
        validate_meeting_id("123")


def test_validate_title_strips_and_rejects_blank():
    assert validate_title("  Standup  ") == "Standup"
    for value in ("", "   ", "x" * 256, None, 42):
        with pytest.raises(InvalidRequestError):
            validate_title(value)


def test_validate_display_name_bounds():
    assert validate_display_name(" Ann ") == "Ann"
    with pytest.raises(InvalidRequestError):
        validate_display_name("   ")
    with pytest.raises(InvalidRequestError):
        validate_display_name("x" * 101)


def test_validate_duration_range():
    assert validate_duration(None) is None
    assert validate_duration(30) == 30
    for value in (0, -5, 1441, "30"):
        with pytest.raises(InvalidRequestError):
            validate_duration(value)


def test_validate_future_datetime_rejects_past_and_accepts_future():
    assert validate_future_datetime(utc_now() + timedelta(minutes=5))
    with pytest.raises(InvalidRequestError):
        validate_future_datetime(utc_now() - timedelta(minutes=1))


def test_validate_meeting_state_and_host(db, meeting):
    validate_meeting_state(meeting, {MeetingStatus.ACTIVE}, action="join")
    with pytest.raises(MeetingConflictError):
        validate_meeting_state(meeting, {MeetingStatus.ENDED}, action="join")

    validate_host(meeting, DEMO_USER_ID, action="end")
    with pytest.raises(InvalidRequestError):
        validate_host(meeting, DEMO_USER_ID + 99, action="end")


# --------------------------------------------------------------------------
# Meeting service
# --------------------------------------------------------------------------


def test_create_meeting_assigns_active_status_host_and_public_id(db):
    created = meeting_service.create_meeting(
        db,
        MeetingCreate(title="  Design review  ", description="  notes  "),
        host_id=DEMO_USER_ID,
    )

    assert created.id != int(created.meeting_id)  # internal PK vs public id
    assert is_valid_meeting_id(created.meeting_id)
    assert created.status is MeetingStatus.ACTIVE
    assert created.host_id == DEMO_USER_ID
    assert created.title == "Design review"
    assert created.description == "notes"
    assert created.end_time is None
    assert created.duration is None
    assert created.meeting_link.endswith(f"/meetings/{created.meeting_id}")


def test_create_meeting_requires_existing_host(db):
    with pytest.raises(InvalidRequestError):
        meeting_service.create_meeting(
            db, MeetingCreate(title="Orphan"), host_id=DEMO_USER_ID + 99
        )


def test_get_meeting_uses_public_id_not_primary_key(db, meeting):
    found = meeting_service.get_meeting(db, meeting.meeting_id)

    assert found is not None
    assert found.id == meeting.id
    assert meeting_service.get_meeting(db, "999999999") is None


def test_require_meeting_raises_not_found(db):
    with pytest.raises(MeetingNotFoundError):
        meeting_service.require_meeting(db, "999999999")


def test_validate_meeting_allows_active_meeting(db, meeting):
    assert meeting_service.validate_meeting(db, meeting.meeting_id).id == meeting.id


def test_validate_meeting_rejects_unknown_and_malformed_ids(db):
    with pytest.raises(MeetingNotFoundError):
        meeting_service.validate_meeting(db, "999999999")
    with pytest.raises(InvalidRequestError):
        meeting_service.validate_meeting(db, "not-an-id")


def test_validate_meeting_rejects_meeting_before_it_starts(db):
    scheduled = _make_scheduled(
        db, title="Tomorrow", start_offset=timedelta(days=1), duration=30
    )

    with pytest.raises(MeetingConflictError, match="not started"):
        meeting_service.validate_meeting(db, scheduled.meeting_id)


def test_validate_meeting_activates_due_scheduled_meeting(db):
    scheduled = _make_scheduled(
        db, title="Due now", start_offset=timedelta(minutes=1), duration=30
    )
    _shift_window(db, scheduled, start_offset=-timedelta(minutes=1), duration=30)

    activated = meeting_service.validate_meeting(db, scheduled.meeting_id)

    assert activated.status is MeetingStatus.ACTIVE
    assert history_service.get_history(db, activated) is not None


def test_validate_meeting_closes_window_that_already_elapsed(db):
    scheduled = _make_scheduled(
        db, title="Missed", start_offset=timedelta(minutes=1), duration=30
    )
    _shift_window(db, scheduled, start_offset=-timedelta(hours=2), duration=30)

    with pytest.raises(MeetingConflictError, match="has ended"):
        meeting_service.validate_meeting(db, scheduled.meeting_id)

    db.refresh(scheduled)
    assert scheduled.status is MeetingStatus.ENDED
    assert history_service.get_history(db, scheduled).ended_at is not None


def test_end_meeting_closes_active_meeting_and_keeps_history(db, meeting):
    ended = meeting_service.end_meeting(db, meeting.meeting_id, host_id=DEMO_USER_ID)

    assert ended.status is MeetingStatus.ENDED
    assert ended.end_time is not None
    # The meetings CHECK only allows NULL or > 0, so a sub-minute meeting is
    # stored as one minute rather than an invalid zero.
    assert ended.duration >= 1

    history = history_service.get_history(db, ended)
    assert history is not None
    assert history.ended_at is not None
    # History keeps the real elapsed minutes (0 is allowed there).
    assert history.duration == minutes_between(history.started_at, history.ended_at)


def test_end_meeting_cancels_a_meeting_that_never_started(db):
    scheduled = _make_scheduled(
        db, title="Cancel me", start_offset=timedelta(days=2), duration=30
    )

    cancelled = meeting_service.end_meeting(
        db, scheduled.meeting_id, host_id=DEMO_USER_ID
    )

    assert cancelled.status is MeetingStatus.CANCELLED
    # The planned window stays on the row; nothing was ever started.
    assert cancelled.end_time == scheduled.end_time
    assert cancelled.duration == 30
    assert history_service.get_history(db, cancelled) is None


def test_end_meeting_enforces_host_ownership(db, meeting):
    with pytest.raises(InvalidRequestError, match="host"):
        meeting_service.end_meeting(db, meeting.meeting_id, host_id=DEMO_USER_ID + 99)


def test_end_meeting_accepts_loaded_row_and_is_idempotent(db, meeting):
    first = meeting_service.end_meeting(db, meeting)
    second = meeting_service.end_meeting(db, meeting)

    assert first.status is MeetingStatus.ENDED
    assert second.status is MeetingStatus.ENDED
    assert second.end_time == first.end_time


def test_end_meeting_rejects_cancelled_meeting(db):
    scheduled = _make_scheduled(
        db, title="Twice", start_offset=timedelta(days=2), duration=30
    )
    meeting_service.end_meeting(db, scheduled.meeting_id, host_id=DEMO_USER_ID)

    with pytest.raises(MeetingConflictError):
        meeting_service.end_meeting(db, scheduled.meeting_id, host_id=DEMO_USER_ID)


def test_end_meeting_rejects_unknown_meeting(db):
    with pytest.raises(MeetingNotFoundError):
        meeting_service.end_meeting(db, "999999999", host_id=DEMO_USER_ID)
    with pytest.raises(InvalidRequestError):
        meeting_service.end_meeting(db, "nope", host_id=DEMO_USER_ID)


# --------------------------------------------------------------------------
# History service
# --------------------------------------------------------------------------


def test_record_meeting_start_is_idempotent(db, meeting):
    first = history_service.record_meeting_start(db, meeting)
    second = history_service.record_meeting_start(db, meeting)

    assert first.id == second.id
    assert first.started_at == meeting.start_time


def test_record_meeting_end_stores_duration_and_participant_count(db, meeting):
    from app.services import participant_service

    participant_service.create_participant(
        db, meeting_id=meeting.id, display_name="Ann"
    )
    ended_at = meeting.start_time + timedelta(minutes=30)

    history = history_service.record_meeting_end(db, meeting, ended_at=ended_at)

    assert history.ended_at == ended_at
    assert history.duration == 30
    assert history.participants_count == 1
    assert history_service.count_participants(db, meeting) == 1


def test_record_meeting_end_clamps_end_before_start(db, meeting):
    history = history_service.record_meeting_end(
        db, meeting, ended_at=meeting.start_time - timedelta(hours=1)
    )

    assert history.ended_at == history.started_at
    assert history.duration == 0


def test_get_recent_history_is_newest_first(db):
    first = meeting_service.create_meeting(
        db, MeetingCreate(title="First"), host_id=DEMO_USER_ID
    )
    second = meeting_service.create_meeting(
        db, MeetingCreate(title="Second"), host_id=DEMO_USER_ID
    )
    history_service.record_meeting_end(
        db, first, ended_at=utc_now() - timedelta(hours=2)
    )
    history_service.record_meeting_end(
        db, second, ended_at=utc_now() - timedelta(minutes=5)
    )
    still_running = meeting_service.create_meeting(
        db, MeetingCreate(title="Running"), host_id=DEMO_USER_ID
    )
    history_service.record_meeting_start(db, still_running)

    recent = history_service.get_recent_history(db)

    assert [row.meeting_id for row in recent] == [second.id, first.id]
    assert all(row.ended_at is not None for row in recent)


def test_history_is_unique_per_meeting(db, meeting):
    history_service.record_meeting_start(db, meeting)
    rows = db.query(MeetingHistory).filter(MeetingHistory.meeting_id == meeting.id).all()

    assert len(rows) == 1


# --------------------------------------------------------------------------
# Seed data
# --------------------------------------------------------------------------


def test_seed_demo_user_is_idempotent(db):
    existing = db.get(User, DEMO_USER_ID)
    db.delete(existing)
    db.commit()

    user, created = seed_demo_user(db)
    assert created is True
    assert user.email == DEMO_USER_EMAIL

    again, created_again = seed_demo_user(db)
    assert created_again is False
    assert again.id == user.id


def test_run_seed_is_idempotent_and_creates_sample_meetings(db):
    first = run_seed(db)
    assert first["meetings"] == 3
    assert first["attendees"] == 2

    second = run_seed(db)
    assert second == {"meetings": 0, "attendees": 0, "users": 0}

    statuses = sorted(
        meeting.status.value
        for meeting in db.query(Meeting).order_by(Meeting.meeting_id).all()
    )
    assert statuses.count("scheduled") == 1
    assert statuses.count("active") >= 1
    assert statuses.count("ended") >= 1


# --------------------------------------------------------------------------
# REST integration (routers -> services -> models)
# --------------------------------------------------------------------------


def test_create_meeting_endpoint_returns_public_id(client):
    response = client.post("/api/meetings", json={"title": "Via API"})

    assert response.status_code == 201
    body = response.json()
    assert is_valid_meeting_id(body["meeting_id"])
    assert body["status"] == "active"
    assert body["host_id"] == DEMO_USER_ID


def test_meeting_endpoints_report_expected_status_codes(client):
    created = client.post("/api/meetings", json={"title": "Lifecycle"}).json()
    meeting_id = created["meeting_id"]

    assert client.get(f"/api/meetings/{meeting_id}").status_code == 200
    assert client.post(
        f"/api/meetings/{meeting_id}/join", json={"display_name": "Ann"}
    ).status_code == 200
    assert client.get("/api/meetings/999999999").status_code == 404
    assert client.post(
        "/api/meetings/999999999/join", json={"display_name": "Ann"}
    ).status_code == 404
    assert client.post(
        "/api/meetings/oops/join", json={"display_name": "Ann"}
    ).status_code == 400

    ended = client.delete(f"/api/meetings/{meeting_id}")
    assert ended.status_code == 200
    assert ended.json()["status"] == "ended"
    assert client.post(
        f"/api/meetings/{meeting_id}/join", json={"display_name": "Ann"}
    ).status_code == 409


def test_user_endpoint_returns_demo_user(client):
    response = client.get("/api/users/me")

    assert response.status_code == 200
    assert response.json()["email"] == DEMO_USER_EMAIL


# --------------------------------------------------------------------------
# SQLite wiring
# --------------------------------------------------------------------------


def test_schema_matches_existing_sqlite_tables():
    engine = create_engine(
        f"sqlite:///{os.path.join(tempfile.gettempdir(), 'zoom_p2_schema.db')}"
    )
    init_db()
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    tables = set(inspector.get_table_names())
    assert {"users", "meetings", "participants", "meeting_history"} <= tables
    assert {"id", "email", "created_at"} <= {
        column["name"] for column in inspector.get_columns("users")
    }
    assert {
        "id",
        "meeting_id",
        "host_id",
        "title",
        "description",
        "start_time",
        "end_time",
        "duration",
        "status",
        "meeting_link",
        "created_at",
    } <= {column["name"] for column in inspector.get_columns("meetings")}
    assert {
        "id",
        "meeting_id",
        "display_name",
        "is_host",
        "is_muted",
        "is_video_on",
        "screen_share",
        "joined_at",
        "left_at",
    } <= {column["name"] for column in inspector.get_columns("participants")}
    assert {
        "id",
        "meeting_id",
        "started_at",
        "ended_at",
        "duration",
        "participants_count",
    } <= {column["name"] for column in inspector.get_columns("meeting_history")}

    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() in (0, 1)

    engine.dispose()
