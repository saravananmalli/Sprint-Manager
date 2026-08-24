import hashlib
import hmac

import pytest
from fastapi.testclient import TestClient

import main
import projects_store


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(projects_store, "USER_PROJECTS_PATH", str(tmp_path / "user_projects.json"))
    monkeypatch.setattr(projects_store, "USER_PROJECTS_LOCK", str(tmp_path / "user_projects.json.lock"))
    before_ids = set(projects_store._projects.keys())
    with TestClient(main.app) as c:
        yield c
    for pid in set(projects_store._projects.keys()) - before_ids:
        projects_store._projects.pop(pid, None)
        projects_store._activity_log.pop(pid, None)
    projects_store.reset_project(projects_store.default_project_id())


def test_create_project_manual(client):
    resp = client.post("/api/projects", json={
        "name": "Manual Squad",
        "teamSlug": "manual-squad",
        "sprintName": "Sprint 1",
        "startDate": "2026-08-01",
        "endDate": "2026-08-10",
        "prefix": "man",
        "tickets": [
            {"id": "MAN-1", "summary": "Do the thing", "status": "Done", "storyPoints": 3},
            {"id": "MAN-2", "summary": "Do the other thing", "status": "Todo", "storyPoints": 2},
        ],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "manual-squad"
    assert body["custom"] is True
    assert body["totalCommitted"] == 5
    assert body["pointsDone"] == 3

    listed = client.get("/api/projects").json()
    assert any(p["id"] == "manual-squad" for p in listed["projects"])


def test_create_project_defaults_a_ticket_when_none_given(client):
    resp = client.post("/api/projects", json={
        "name": "Empty Squad", "teamSlug": "empty-squad", "sprintName": "S1",
        "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "EMP", "tickets": [],
    })
    assert resp.status_code == 200
    sprint = client.get("/api/projects/empty-squad/sprint").json()
    assert len(sprint["tickets"]) == 1


def test_create_project_rejects_blank_name(client):
    resp = client.post("/api/projects", json={
        "name": "  ", "teamSlug": "x", "sprintName": "S1",
        "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "X", "tickets": [],
    })
    assert resp.status_code == 422


def test_import_project_csv(client):
    csv_bytes = b"id,summary,status,storyPoints\nIMP-1,First,Done,5\nIMP-2,Second,Todo,3\n"
    resp = client.post(
        "/api/projects/import",
        data={"name": "Imported Squad", "teamSlug": "imported", "sprintName": "S1",
              "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "IMP"},
        files={"file": ("tickets.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "imported-squad"
    assert body["totalCommitted"] == 8


def test_import_project_rejects_non_csv(client):
    resp = client.post(
        "/api/projects/import",
        data={"name": "X", "teamSlug": "x", "sprintName": "S1",
              "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "X"},
        files={"file": ("tickets.txt", b"id,summary\nA,B\n", "text/plain")},
    )
    assert resp.status_code == 400


def test_import_project_rejects_bad_csv(client):
    resp = client.post(
        "/api/projects/import",
        data={"name": "X", "teamSlug": "x", "sprintName": "S1",
              "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "X"},
        files={"file": ("tickets.csv", b"foo,bar\n1,2\n", "text/csv")},
    )
    assert resp.status_code == 400


def test_delete_project(client):
    client.post("/api/projects", json={
        "name": "Throwaway", "teamSlug": "throwaway", "sprintName": "S1",
        "startDate": "2026-08-01", "endDate": "2026-08-10", "prefix": "TA", "tickets": [],
    })
    resp = client.delete("/api/projects/throwaway")
    assert resp.status_code == 200
    assert client.get("/api/projects/throwaway/sprint").status_code == 404


def test_delete_project_rejects_seed(client):
    seed_id = projects_store.default_project_id()
    resp = client.delete(f"/api/projects/{seed_id}")
    assert resp.status_code == 400


def test_webhook_git_moves_ticket_without_secret(client, monkeypatch):
    monkeypatch.delenv("GIT_WEBHOOK_SECRET", raising=False)
    project_id = projects_store.default_project_id()
    resp = client.post("/api/webhooks/git", json={
        "project": project_id, "event": "git.pr_merged", "ticketIds": ["CHK-105"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"][0]["ticketId"] == "CHK-105"
    assert body["applied"][0]["to"] == "Done"


def test_webhook_git_skips_ineligible_ticket(client, monkeypatch):
    monkeypatch.delenv("GIT_WEBHOOK_SECRET", raising=False)
    project_id = projects_store.default_project_id()
    resp = client.post("/api/webhooks/git", json={
        "project": project_id, "event": "git.pr_merged", "ticketIds": ["CHK-101"],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"] == []
    assert body["skipped"][0]["ticketId"] == "CHK-101"


def test_webhook_git_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setenv("GIT_WEBHOOK_SECRET", "topsecret")
    project_id = projects_store.default_project_id()
    resp = client.post(
        "/api/webhooks/git",
        json={"project": project_id, "event": "git.pr_merged", "ticketIds": ["CHK-105"]},
        headers={"X-Webhook-Signature": "wrong"},
    )
    assert resp.status_code == 401


def test_webhook_git_accepts_valid_signature(client, monkeypatch):
    monkeypatch.setenv("GIT_WEBHOOK_SECRET", "topsecret")
    project_id = projects_store.default_project_id()
    body_bytes = (
        b'{"project": "' + project_id.encode() + b'", "event": "git.pr_merged", "ticketIds": ["CHK-105"]}'
    )
    signature = hmac.new(b"topsecret", body_bytes, hashlib.sha256).hexdigest()
    resp = client.post(
        "/api/webhooks/git",
        content=body_bytes,
        headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"},
    )
    assert resp.status_code == 200


def test_webhook_git_rejects_unknown_event(client, monkeypatch):
    monkeypatch.delenv("GIT_WEBHOOK_SECRET", raising=False)
    project_id = projects_store.default_project_id()
    resp = client.post("/api/webhooks/git", json={
        "project": project_id, "event": "not.a.real.event", "ticketIds": ["CHK-105"],
    })
    assert resp.status_code == 422
