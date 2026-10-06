"""WebSocket realtime tests.

These tests depend on Backend Developer 1's database base, Meeting model and
meeting service. Until those modules exist, this file cannot be collected by
pytest. Once they land, run with::

    cd backend
    pytest tests/test_websocket.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.main import create_app
from app.websocket.manager import get_manager

MEETING_A = "839452761"
MEETING_B = "111222333"


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    app = create_app()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    get_manager()._meetings.clear()
    get_manager()._screen_sharing.clear()
    with TestClient(app) as test_client:
        test_client.testing_session = TestingSession  # type: ignore[attr-defined]
        yield test_client


@pytest.fixture()
def db(client):
    return client.testing_session()


def _seed_meeting(db, meeting_id: str, host_id: int = 1) -> None:
    from app.models.meeting import Meeting

    db.add(Meeting(id=meeting_id, host_id=host_id))
    db.commit()


def _create_participant(db, meeting_id: str, name: str, user_id: int | None = None):
    from app.services import participant_service

    return participant_service.create_participant(
        db,
        meeting_id=meeting_id,
        display_name=name,
        user_id=user_id,
    )


def _join(client, meeting_id: str, participant_id: int, name: str):
    socket = client.websocket_connect(f"/ws/meetings/{meeting_id}")
    socket.send_json(
        {
            "type": "join",
            "meeting_id": meeting_id,
            "participant_id": participant_id,
            "display_name": name,
        }
    )
    return socket, socket.receive_json()


def test_connection_and_join(client, db):
    _seed_meeting(db, MEETING_A)
    participant = _create_participant(db, MEETING_A, "John")

    socket, response = _join(client, MEETING_A, participant.id, "John")

    assert response["type"] == "joined"
    assert response["meeting_id"] == MEETING_A
    assert response["participant_id"] == participant.id
    socket.close()


def test_invalid_meeting_rejected(client):
    with client.websocket_connect(f"/ws/meetings/{MEETING_B}") as socket:
        response = socket.receive_json()
    assert response["type"] == "error"
    assert response["code"] == "MEETING_NOT_FOUND"


def test_participant_joined_and_left_broadcast(client, db):
    _seed_meeting(db, MEETING_A)
    first = _create_participant(db, MEETING_A, "Alice")
    second = _create_participant(db, MEETING_A, "Bob")

    socket_one, joined_one = _join(client, MEETING_A, first.id, "Alice")
    socket_two, joined_two = _join(client, MEETING_A, second.id, "Bob")

    assert joined_two["type"] == "joined"
    assert [p["id"] for p in joined_two["participants"]] == [first.id]

    joined_event = socket_one.receive_json()
    assert joined_event["type"] == "participant_joined"
    assert joined_event["participant"]["id"] == second.id
    assert joined_event["participant"]["display_name"] == "Bob"

    socket_two.send_json({"type": "leave", "participant_id": second.id})
    left_event = socket_one.receive_json()
    assert left_event == {
        "type": "participant_left",
        "participant_id": second.id,
    }

    socket_one.close()
    socket_two.close()


def test_offer_answer_and_ice_routing(client, db):
    _seed_meeting(db, MEETING_A)
    sender = _create_participant(db, MEETING_A, "Sender")
    target = _create_participant(db, MEETING_A, "Target")

    socket_sender, _ = _join(client, MEETING_A, sender.id, "Sender")
    socket_target, _ = _join(client, MEETING_A, target.id, "Target")
    socket_sender.receive_json()
    socket_target.receive_json()

    sdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n"
    socket_sender.send_json(
        {
            "type": "offer",
            "sender_id": sender.id,
            "target_id": target.id,
            "payload": {"sdp": sdp},
        }
    )
    offer = socket_target.receive_json()
    assert offer["type"] == "offer"
    assert offer["sender_id"] == sender.id
    assert offer["payload"] == {"sdp": sdp}

    socket_target.send_json(
        {
            "type": "answer",
            "sender_id": target.id,
            "target_id": sender.id,
            "payload": {"sdp": "answer-sdp"},
        }
    )
    answer = socket_sender.receive_json()
    assert answer["type"] == "answer"
    assert answer["payload"] == {"sdp": "answer-sdp"}

    ice = {"candidate": "candidate:1 1 UDP", "sdpMid": "0", "sdpMLineIndex": 0}
    socket_sender.send_json(
        {
            "type": "ice_candidate",
            "sender_id": sender.id,
            "target_id": target.id,
            "payload": ice,
        }
    )
    ice_event = socket_target.receive_json()
    assert ice_event["type"] == "ice_candidate"
    assert ice_event["payload"] == ice

    socket_sender.close()
    socket_target.close()


def test_media_state_and_screen_share_broadcast(client, db):
    _seed_meeting(db, MEETING_A)
    watcher = _create_participant(db, MEETING_A, "Watcher")
    actor = _create_participant(db, MEETING_A, "Actor")

    socket_watcher, _ = _join(client, MEETING_A, watcher.id, "Watcher")
    socket_actor, _ = _join(client, MEETING_A, actor.id, "Actor")
    socket_watcher.receive_json()
    socket_actor.receive_json()

    socket_actor.send_json(
        {
            "type": "media_state",
            "participant_id": actor.id,
            "is_muted": True,
            "is_video_on": False,
        }
    )
    media_event = socket_watcher.receive_json()
    assert media_event["type"] == "participant_updated"
    assert media_event["participant"] == {
        "id": actor.id,
        "is_muted": True,
        "is_video_on": False,
    }

    socket_actor.send_json(
        {
            "type": "screen_share",
            "participant_id": actor.id,
            "active": True,
        }
    )
    share_event = socket_watcher.receive_json()
    assert share_event["type"] == "participant_updated"
    assert share_event["participant"] == {"id": actor.id, "screen_share": True}

    socket_watcher.close()
    socket_actor.close()


def test_host_mute_and_unauthorized_mute(client, db):
    _seed_meeting(db, MEETING_A, host_id=1)
    host = _create_participant(db, MEETING_A, "Host", user_id=1)
    guest = _create_participant(db, MEETING_A, "Guest", user_id=2)

    socket_host, _ = _join(client, MEETING_A, host.id, "Host")
    socket_guest, _ = _join(client, MEETING_A, guest.id, "Guest")
    socket_host.receive_json()
    socket_guest.receive_json()

    socket_guest.send_json(
        {
            "type": "mute_participant",
            "participant_id": guest.id,
            "target_id": host.id,
        }
    )
    unauthorized = socket_guest.receive_json()
    assert unauthorized["type"] == "error"
    assert unauthorized["code"] == "NOT_HOST"

    socket_host.send_json(
        {
            "type": "mute_participant",
            "participant_id": host.id,
            "target_id": guest.id,
        }
    )
    host_action = socket_guest.receive_json()
    assert host_action == {
        "type": "host_action",
        "action": "mute",
        "target_id": guest.id,
    }

    socket_host.close()
    socket_guest.close()


def test_host_remove_participant(client, db):
    _seed_meeting(db, MEETING_A, host_id=1)
    host = _create_participant(db, MEETING_A, "Host", user_id=1)
    guest = _create_participant(db, MEETING_A, "Guest", user_id=2)

    socket_host, _ = _join(client, MEETING_A, host.id, "Host")
    socket_guest, _ = _join(client, MEETING_A, guest.id, "Guest")
    socket_host.receive_json()
    socket_guest.receive_json()

    socket_host.send_json(
        {
            "type": "remove_participant",
            "participant_id": host.id,
            "target_id": guest.id,
        }
    )

    removal = socket_guest.receive_json()
    assert removal == {
        "type": "host_action",
        "action": "removed",
        "target_id": guest.id,
    }

    left = socket_host.receive_json()
    assert left == {"type": "participant_left", "participant_id": guest.id}

    socket_host.close()


def test_unauthorized_remove_and_end_meeting(client, db):
    _seed_meeting(db, MEETING_A, host_id=1)
    host = _create_participant(db, MEETING_A, "Host", user_id=1)
    guest = _create_participant(db, MEETING_A, "Guest", user_id=2)

    socket_host, _ = _join(client, MEETING_A, host.id, "Host")
    socket_guest, _ = _join(client, MEETING_A, guest.id, "Guest")
    socket_host.receive_json()
    socket_guest.receive_json()

    socket_guest.send_json(
        {
            "type": "remove_participant",
            "participant_id": guest.id,
            "target_id": host.id,
        }
    )
    assert socket_guest.receive_json()["code"] == "NOT_HOST"

    socket_guest.send_json({"type": "end_meeting", "participant_id": guest.id})
    assert socket_guest.receive_json()["code"] == "NOT_HOST"

    socket_host.send_json({"type": "end_meeting", "participant_id": host.id})
    ended = socket_guest.receive_json()
    assert ended == {"type": "meeting_ended", "meeting_id": MEETING_A}

    socket_host.close()


def test_meeting_isolation(client, db):
    _seed_meeting(db, MEETING_A)
    _seed_meeting(db, MEETING_B)

    a1 = _create_participant(db, MEETING_A, "A1")
    a2 = _create_participant(db, MEETING_A, "A2")
    b1 = _create_participant(db, MEETING_B, "B1")
    b2 = _create_participant(db, MEETING_B, "B2")

    socket_a1, _ = _join(client, MEETING_A, a1.id, "A1")
    socket_a2, _ = _join(client, MEETING_A, a2.id, "A2")
    socket_b1, _ = _join(client, MEETING_B, b1.id, "B1")
    socket_b2, _ = _join(client, MEETING_B, b2.id, "B2")

    joined_a = socket_a1.receive_json()
    assert joined_a["type"] == "participant_joined"
    assert joined_a["participant"]["display_name"] == "A2"

    joined_b = socket_b1.receive_json()
    assert joined_b["participant"]["display_name"] == "B2"

    socket_a2.send_json({"type": "media_state", "participant_id": a2.id, "is_muted": True, "is_video_on": True})
    a_update = socket_a1.receive_json()
    assert a_update["participant"]["id"] == a2.id

    socket_b2.send_json({"type": "leave", "participant_id": b2.id})
    b_left = socket_b1.receive_json()
    assert b_left["participant_id"] == b2.id

    for socket in (socket_a1, socket_a2, socket_b1, socket_b2):
        socket.close()


def test_disconnect_cleanup_removes_connection(client, db):
    _seed_meeting(db, MEETING_A)
    a1 = _create_participant(db, MEETING_A, "A1")
    a2 = _create_participant(db, MEETING_A, "A2")

    socket_a1, _ = _join(client, MEETING_A, a1.id, "A1")
    socket_a2, _ = _join(client, MEETING_A, a2.id, "A2")
    socket_a1.receive_json()

    socket_a2.close()

    left = socket_a1.receive_json()
    assert left == {"type": "participant_left", "participant_id": a2.id}

    remaining = get_manager().get_meeting_participants(MEETING_A)
    assert a2.id not in remaining
    socket_a1.close()


def test_invalid_message_returns_error(client, db):
    _seed_meeting(db, MEETING_A)
    participant = _create_participant(db, MEETING_A, "John")
    socket, _ = _join(client, MEETING_A, participant.id, "John")

    socket.send_json({"type": "totally_unknown", "x": 1})
    assert socket.receive_json() == {
        "type": "error",
        "code": "INVALID_MESSAGE",
        "message": "Invalid realtime message",
    }

    socket.send_json({"no_type": True})
    assert socket.receive_json()["code"] == "INVALID_MESSAGE"

    socket.send_json({"type": "leave", "participant_id": "not-an-int"})
    assert socket.receive_json()["code"] == "INVALID_MESSAGE"

    socket.send_json("not-json-object")
    assert socket.receive_json()["code"] == "INVALID_MESSAGE"

    socket.close()


def test_signaling_rejects_foreign_sender(client, db):
    _seed_meeting(db, MEETING_A)
    sender = _create_participant(db, MEETING_A, "Sender")
    target = _create_participant(db, MEETING_A, "Target")

    socket_sender, _ = _join(client, MEETING_A, sender.id, "Sender")
    socket_target, _ = _join(client, MEETING_A, target.id, "Target")
    socket_sender.receive_json()
    socket_target.receive_json()

    socket_sender.send_json(
        {
            "type": "offer",
            "sender_id": target.id,
            "target_id": target.id,
            "payload": {"sdp": "spoofed"},
        }
    )
    response = socket_sender.receive_json()
    assert response["type"] == "error"
    assert response["code"] == "UNAUTHORIZED_ACTION"

    socket_sender.close()
    socket_target.close()


def test_signaling_rejects_target_from_other_meeting(client, db):
    _seed_meeting(db, MEETING_A)
    _seed_meeting(db, MEETING_B)
    sender = _create_participant(db, MEETING_A, "Sender")
    outsider = _create_participant(db, MEETING_B, "Outsider")

    socket_sender, _ = _join(client, MEETING_A, sender.id, "Sender")

    socket_sender.send_json(
        {
            "type": "offer",
            "sender_id": sender.id,
            "target_id": outsider.id,
            "payload": {"sdp": "v=0"},
        }
    )
    response = socket_sender.receive_json()
    assert response["code"] == "TARGET_NOT_FOUND"

    socket_sender.close()


def test_reconnect_reuses_participant(client, db):
    _seed_meeting(db, MEETING_A)
    participant = _create_participant(db, MEETING_A, "John")

    socket, _ = _join(client, MEETING_A, participant.id, "John")
    socket.close()

    socket_again, joined = _join(client, MEETING_A, participant.id, "John")
    assert joined["type"] == "joined"
    assert joined["participant_id"] == participant.id
    assert joined["participants"] == []
    socket_again.close()


def test_meeting_state_snapshot_on_rejoin(client, db):
    _seed_meeting(db, MEETING_A)
    watcher = _create_participant(db, MEETING_A, "Watcher")
    actor = _create_participant(db, MEETING_A, "Actor")

    socket_watcher, _ = _join(client, MEETING_A, watcher.id, "Watcher")
    socket_actor, _ = _join(client, MEETING_A, actor.id, "Actor")
    socket_watcher.receive_json()
    socket_actor.receive_json()

    socket_actor.close()
    socket_watcher.receive_json()

    socket_late, joined = _join(client, MEETING_A, watcher.id, "Watcher")
    assert joined["type"] == "joined"
    assert [p["id"] for p in joined["participants"]] == [watcher.id]

    socket_late.close()
    socket_watcher.close()


def test_messages_before_join_are_rejected(client, db):
    _seed_meeting(db, MEETING_A)
    with client.websocket_connect(f"/ws/meetings/{MEETING_A}") as socket:
        socket.send_json(
            {"type": "media_state", "participant_id": 1, "is_muted": True, "is_video_on": True}
        )
        response = socket.receive_json()
    assert response["type"] == "error"
    assert response["code"] == "NOT_A_PARTICIPANT"


def test_participant_rest_endpoints(client, db):
    _seed_meeting(db, MEETING_A)

    created = client.post(
        f"/api/meetings/{MEETING_A}/participants",
        json={"display_name": "Rest User", "is_muted": False, "is_video_on": True},
    )
    assert created.status_code == 201
    participant_id = created.json()["id"]

    listed = client.get(f"/api/meetings/{MEETING_A}/participants")
    assert listed.status_code == 200
    assert [p["id"] for p in listed.json()] == [participant_id]

    deleted = client.delete(f"/api/participants/{participant_id}")
    assert deleted.status_code == 204

    assert client.delete("/api/participants/99999").status_code == 404