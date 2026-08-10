"""
Authorization regression tests.

These cover the object-level access control on candidate-scoped endpoints. The
original implementation authenticated the caller but never checked that the
candidate belonged to them, so any logged-in user could read or mutate any
candidate by id. Each test here fails against that behaviour.
"""

import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402
from core.db import (  # noqa: E402
    db_create_screening,
    db_create_candidate,
    db_get_candidate_owned,
    db_update_candidate_status,
    db_update_candidate_notes,
    db_delete_screening,
    init_db,
)

client = TestClient(app)


def _signup(email: str, password: str = "test-password") -> str:
    """Create (or reuse) an account and return a bearer token."""
    payload = {"email": email, "password": password, "name": "Test User", "role": "Recruitment Lead"}
    resp = client.post("/api/auth/signup", json=payload)
    if resp.status_code == 201:
        return resp.json()["token"]
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return login.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def _schema():
    init_db()


@pytest.fixture
def two_users():
    suffix = uuid.uuid4().hex[:8]
    owner_email = f"owner_{suffix}@hiregrid.test"
    other_email = f"other_{suffix}@hiregrid.test"
    return {
        "owner_email": owner_email,
        "owner_token": _signup(owner_email),
        "other_email": other_email,
        "other_token": _signup(other_email),
    }


@pytest.fixture
def owned_candidate(two_users):
    """A screening + candidate belonging to the owner user."""
    screening_id = f"screening-{uuid.uuid4().hex}"
    cand_id = f"cand-{uuid.uuid4().hex}"

    assert db_create_screening(
        sc_id=screening_id,
        email=two_users["owner_email"],
        job_title="Senior Backend Engineer",
        job_desc="Build APIs.",
        req_skills=["Python", "FastAPI"],
    )
    assert db_create_candidate(
        cand_id=cand_id,
        screening_id=screening_id,
        name="Owned Candidate",
        filename="owned.pdf",
        file_path="",
        score=77.5,
        breakdown={"skills": 80.0, "semantic_similarity": 70.0, "experience": 90.0},
        matched=["Python"],
        missing=["FastAPI"],
        yoe=5.0,
        loc="Remote",
        summary="A candidate.",
        details_json="{}",
    )
    yield {"screening_id": screening_id, "cand_id": cand_id, **two_users}
    db_delete_screening(screening_id, two_users["owner_email"])


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Data layer ────────────────────────────────────────────────────────────────

def test_owner_can_load_own_candidate(owned_candidate):
    row = db_get_candidate_owned(owned_candidate["cand_id"], owned_candidate["owner_email"])
    assert row is not None
    assert row["candidate_name"] == "Owned Candidate"


def test_other_user_cannot_load_candidate(owned_candidate):
    row = db_get_candidate_owned(owned_candidate["cand_id"], owned_candidate["other_email"])
    assert row is None


def test_other_user_cannot_update_status(owned_candidate):
    assert db_update_candidate_status(
        owned_candidate["cand_id"], "Hired", owned_candidate["other_email"]
    ) is False
    # The stored value must be untouched.
    row = db_get_candidate_owned(owned_candidate["cand_id"], owned_candidate["owner_email"])
    assert row["status"] != "Hired"


def test_other_user_cannot_update_notes(owned_candidate):
    assert db_update_candidate_notes(
        owned_candidate["cand_id"], "leaked", owned_candidate["other_email"]
    ) is False
    row = db_get_candidate_owned(owned_candidate["cand_id"], owned_candidate["owner_email"])
    assert row["notes"] != "leaked"


def test_owner_can_update_status_and_notes(owned_candidate):
    assert db_update_candidate_status(
        owned_candidate["cand_id"], "Shortlisted", owned_candidate["owner_email"]
    ) is True
    assert db_update_candidate_notes(
        owned_candidate["cand_id"], "Strong fit", owned_candidate["owner_email"]
    ) is True
    row = db_get_candidate_owned(owned_candidate["cand_id"], owned_candidate["owner_email"])
    assert row["status"] == "Shortlisted"
    assert row["notes"] == "Strong fit"


# ── HTTP layer ────────────────────────────────────────────────────────────────

def test_status_endpoint_rejects_other_user(owned_candidate):
    resp = client.patch(
        f"/api/candidates/{owned_candidate['cand_id']}/status",
        json={"status": "Hired"},
        headers=_auth(owned_candidate["other_token"]),
    )
    assert resp.status_code == 404


def test_notes_endpoint_rejects_other_user(owned_candidate):
    resp = client.patch(
        f"/api/candidates/{owned_candidate['cand_id']}/notes",
        json={"notes": "leaked"},
        headers=_auth(owned_candidate["other_token"]),
    )
    assert resp.status_code == 404


def test_cv_download_rejects_other_user(owned_candidate):
    resp = client.get(
        f"/api/candidates/{owned_candidate['cand_id']}/cv",
        headers=_auth(owned_candidate["other_token"]),
    )
    assert resp.status_code == 404


def test_screening_detail_rejects_other_user(owned_candidate):
    resp = client.get(
        f"/api/screenings/{owned_candidate['screening_id']}",
        headers=_auth(owned_candidate["other_token"]),
    )
    assert resp.status_code == 404


def test_screening_delete_rejects_other_user(owned_candidate):
    resp = client.delete(
        f"/api/screenings/{owned_candidate['screening_id']}",
        headers=_auth(owned_candidate["other_token"]),
    )
    assert resp.status_code == 404
    # Still present for the real owner.
    owner_resp = client.get(
        f"/api/screenings/{owned_candidate['screening_id']}",
        headers=_auth(owned_candidate["owner_token"]),
    )
    assert owner_resp.status_code == 200


def test_owner_endpoints_succeed(owned_candidate):
    resp = client.patch(
        f"/api/candidates/{owned_candidate['cand_id']}/status",
        json={"status": "Interview"},
        headers=_auth(owned_candidate["owner_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "Interview"


def test_invalid_status_is_rejected(owned_candidate):
    resp = client.patch(
        f"/api/candidates/{owned_candidate['cand_id']}/status",
        json={"status": "'; DROP TABLE candidates; --"},
        headers=_auth(owned_candidate["owner_token"]),
    )
    assert resp.status_code == 400


def test_endpoints_require_authentication(owned_candidate):
    cand_id = owned_candidate["cand_id"]
    assert client.get(f"/api/candidates/{cand_id}/cv").status_code == 401
    assert client.patch(f"/api/candidates/{cand_id}/notes", json={"notes": "x"}).status_code == 401
    assert client.get("/api/analytics").status_code == 401


def test_analytics_is_scoped_to_the_caller(owned_candidate):
    owner = client.get("/api/analytics", headers=_auth(owned_candidate["owner_token"]))
    other = client.get("/api/analytics", headers=_auth(owned_candidate["other_token"]))
    assert owner.status_code == 200 and other.status_code == 200
    assert owner.json()["total_candidates"] >= 1
    # The second user owns nothing, so none of the owner's data may appear.
    assert other.json()["total_candidates"] == 0
    assert other.json()["total_screenings"] == 0
