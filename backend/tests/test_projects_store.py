import json

import pytest

import projects_store


@pytest.fixture
def isolated_user_store(tmp_path, monkeypatch):
    """Redirect user-project persistence to a scratch file so tests never
    touch the real backend/user_projects.json, and undo any in-memory
    project mutation after the test."""
    path = tmp_path / "user_projects.json"
    monkeypatch.setattr(projects_store, "USER_PROJECTS_PATH", str(path))
    monkeypatch.setattr(projects_store, "USER_PROJECTS_LOCK", str(path) + ".lock")
    before_ids = set(projects_store._projects.keys())
    before_team = list(projects_store._team)
    yield path
    for pid in set(projects_store._projects.keys()) - before_ids:
        projects_store._projects.pop(pid, None)
        projects_store._activity_log.pop(pid, None)
    projects_store._team[:] = before_team


TICKETS = [
    {"id": "NEW-1", "summary": "First", "status": "Done", "assignee": {"name": "Jo", "email": "jo@co.com"},
     "storyPoints": 3, "blockers": [], "acceptanceCriteria": "", "lastUpdated": "2026-08-01T00:00:00Z", "createdAt": "2026-08-01T00:00:00Z"},
    {"id": "NEW-2", "summary": "Second", "status": "Todo", "assignee": {"name": "Jo", "email": "jo@co.com"},
     "storyPoints": 5, "blockers": [], "acceptanceCriteria": "", "lastUpdated": "2026-08-01T00:00:00Z", "createdAt": "2026-08-01T00:00:00Z"},
]


def test_create_project_computes_totals_and_persists(isolated_user_store):
    project = projects_store.create_project(
        name="New Squad", team_slug="new-squad", sprint_name="Sprint 1",
        start_date="2026-08-01", end_date="2026-08-10", prefix="NEW", tickets=TICKETS,
    )
    assert project["id"] == "new-squad"
    assert project["totalCommitted"] == 8
    assert project["pointsDone"] == 3
    assert projects_store.get_project("new-squad") is project
    assert json.loads(isolated_user_store.read_text())[0]["id"] == "new-squad"


def test_create_project_dedupes_id_on_name_collision(isolated_user_store):
    p1 = projects_store.create_project(
        name="Dup", team_slug="dup", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="DUP", tickets=TICKETS,
    )
    p2 = projects_store.create_project(
        name="Dup", team_slug="dup", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="DUP", tickets=TICKETS,
    )
    assert p1["id"] == "dup"
    assert p2["id"] == "dup-2"


def test_create_project_adds_new_assignees_to_team(isolated_user_store):
    before = len(projects_store.get_team())
    projects_store.create_project(
        name="Team Growth", team_slug="tg", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="TG", tickets=TICKETS,
    )
    after = projects_store.get_team()
    assert len(after) == before + 1
    assert any(m["email"] == "jo@co.com" for m in after)


def test_is_user_created_distinguishes_seed_projects(isolated_user_store):
    seed_id = projects_store.default_project_id()
    assert projects_store.is_user_created(seed_id) is False
    project = projects_store.create_project(
        name="User Made", team_slug="um", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="UM", tickets=TICKETS,
    )
    assert projects_store.is_user_created(project["id"]) is True


def test_delete_project_removes_user_created(isolated_user_store):
    project = projects_store.create_project(
        name="Deletable", team_slug="del", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="DEL", tickets=TICKETS,
    )
    projects_store.delete_project(project["id"])
    with pytest.raises(KeyError):
        projects_store.get_project(project["id"])
    assert json.loads(isolated_user_store.read_text()) == []


def test_delete_project_rejects_seed_projects(isolated_user_store):
    seed_id = projects_store.default_project_id()
    with pytest.raises(ValueError, match="cannot be deleted"):
        projects_store.delete_project(seed_id)


def test_reset_project_rejects_user_created(isolated_user_store):
    project = projects_store.create_project(
        name="No Reset", team_slug="nr", sprint_name="S1", start_date="2026-08-01",
        end_date="2026-08-10", prefix="NR", tickets=TICKETS,
    )
    with pytest.raises(ValueError, match="no seed data"):
        projects_store.reset_project(project["id"])
