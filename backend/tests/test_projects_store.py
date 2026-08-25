import pytest

import projects_store


@pytest.fixture
def isolated_user_store():
    """Track any project (and any team member) created during the test and
    remove it afterward — deleting a project cascades to its tickets/
    health_history/activity_log rows in Supabase, but team_members has no
    FK to projects, so new members are cleaned up separately. Never touches
    seed data or truncates a table, since tests run against the same
    Supabase project the app uses."""
    before_ids = set(projects_store.list_project_ids())
    before_emails = {m["email"] for m in projects_store.get_team()}
    yield
    for pid in set(projects_store.list_project_ids()) - before_ids:
        try:
            projects_store.delete_project(pid)
        except ValueError:
            pass
    after_emails = {m["email"] for m in projects_store.get_team()}
    for email in after_emails - before_emails:
        projects_store._client.table("team_members").delete().eq("email", email).execute()


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
    assert projects_store.get_project("new-squad") == project
    assert projects_store.is_user_created("new-squad") is True


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


def test_reset_project_restores_seed_tickets(isolated_user_store):
    seed_id = projects_store.default_project_id()
    original = projects_store.get_project(seed_id)
    ticket_id = original["tickets"][0]["id"]

    projects_store.update_ticket(seed_id, ticket_id, status="Done", last_updated="2026-08-20T00:00:00Z")
    projects_store.append_activity(seed_id, {
        "ticketId": ticket_id, "from": "Backlog", "to": "Done",
        "event": "manual.move", "actor": "test", "at": "2026-08-20T00:00:00Z",
    })

    restored = projects_store.reset_project(seed_id)
    restored_ticket = next(t for t in restored["tickets"] if t["id"] == ticket_id)
    original_ticket = next(t for t in original["tickets"] if t["id"] == ticket_id)
    assert restored_ticket["status"] == original_ticket["status"]
    assert projects_store.get_activity_log(seed_id) == []
