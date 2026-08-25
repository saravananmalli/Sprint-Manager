"""Supabase-backed multi-project store.

Mutations (kanban moves, automation events, project create/delete) persist
immediately to Supabase — there is no in-memory cache to keep in sync.
`reset_project` restores a project's tickets from the read-only
`seed_tickets` snapshot table (populated once by migrations/seed_supabase.py).
"""

import os
import re

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _ticket_from_row(row):
    assignee = {}
    if row.get("assignee_email") or row.get("assignee_name"):
        assignee = {"name": row.get("assignee_name"), "email": row.get("assignee_email")}
    return {
        "id": row["id"],
        "summary": row["summary"],
        "status": row["status"],
        "assignee": assignee,
        "storyPoints": row.get("story_points", 0),
        "priority": row.get("priority"),
        "priorityLabel": row.get("priority_label"),
        "lastUpdated": row.get("last_updated"),
        "createdAt": row.get("created_at"),
        "blockers": row.get("blockers") or [],
        "acceptanceCriteria": row.get("acceptance_criteria", ""),
    }


def _ticket_row(project_id, ticket):
    assignee = ticket.get("assignee") or {}
    return {
        "project_id": project_id,
        "id": ticket["id"],
        "summary": ticket["summary"],
        "status": ticket["status"],
        "assignee_name": assignee.get("name"),
        "assignee_email": assignee.get("email"),
        "story_points": ticket.get("storyPoints", 0),
        "priority": ticket.get("priority"),
        "priority_label": ticket.get("priorityLabel"),
        "last_updated": ticket.get("lastUpdated"),
        "created_at": ticket.get("createdAt"),
        "blockers": ticket.get("blockers", []),
        "acceptance_criteria": ticket.get("acceptanceCriteria", ""),
    }


def _project_from_row(row, tickets):
    return {
        "id": row["id"],
        "name": row["name"],
        "teamSlug": row["team_slug"],
        "channel": row["channel"],
        "sprintName": row["sprint_name"],
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "totalCommitted": row.get("total_committed", 0),
        "pointsDone": row.get("points_done", 0),
        "prefix": row["prefix"],
        "jiraBoardId": row.get("jira_board_id"),
        "jiraSprintId": row.get("jira_sprint_id"),
        "isSeed": row.get("is_seed", False),
        "tickets": tickets,
    }


def _activity_from_row(row):
    return {
        "ticketId": row.get("ticket_id"),
        "from": row.get("from"),
        "to": row.get("to"),
        "event": row["event"],
        "branch": row.get("branch"),
        "actor": row["actor"],
        "at": row.get("at"),
    }


def list_project_ids():
    resp = _client.table("projects").select("id").order("created_at").execute()
    return [r["id"] for r in resp.data]


def get_project(project_id):
    resp = _client.table("projects").select("*").eq("id", project_id).execute()
    if not resp.data:
        raise KeyError(f"Unknown project '{project_id}'")
    tickets_resp = _client.table("tickets").select("*").eq("project_id", project_id).execute()
    tickets = [_ticket_from_row(r) for r in tickets_resp.data]
    return _project_from_row(resp.data[0], tickets)


def default_project_id():
    resp = (
        _client.table("projects")
        .select("id")
        .order("created_at")
        .order("id")
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise KeyError("No projects exist")
    return resp.data[0]["id"]


def all_projects():
    projects_resp = _client.table("projects").select("*").order("created_at").execute()
    project_rows = projects_resp.data
    if not project_rows:
        return []
    ids = [p["id"] for p in project_rows]
    tickets_resp = _client.table("tickets").select("*").in_("project_id", ids).execute()
    tickets_by_project = {}
    for t in tickets_resp.data:
        tickets_by_project.setdefault(t["project_id"], []).append(_ticket_from_row(t))
    return [_project_from_row(p, tickets_by_project.get(p["id"], [])) for p in project_rows]


def get_team():
    resp = _client.table("team_members").select("*").order("created_at").execute()
    return [{"name": r["name"], "email": r["email"], "role": r["role"]} for r in resp.data]


def get_activity_log(project_id):
    resp = (
        _client.table("activity_log")
        .select("*")
        .eq("project_id", project_id)
        .order("at", desc=True)
        .limit(50)
        .execute()
    )
    return [_activity_from_row(r) for r in resp.data]


def get_activity_logs_batch(project_ids, limit_per_project=50):
    """Like get_activity_log, but for many projects in a single query —
    used by team_insights.list_team, which otherwise fires one query per
    project per team member. Approximate per-project cap (bounded by the
    overall LIMIT below, not a per-project window function), which is fine
    for its one caller: team-page "recent activity" only ever keeps the top
    5 after combining, so a large shared limit is more than enough."""
    if not project_ids:
        return {}
    resp = (
        _client.table("activity_log")
        .select("*")
        .in_("project_id", project_ids)
        .order("at", desc=True)
        .limit(limit_per_project * len(project_ids))
        .execute()
    )
    by_project = {pid: [] for pid in project_ids}
    for row in resp.data:
        by_project.setdefault(row["project_id"], []).append(_activity_from_row(row))
    return by_project


def append_activity(project_id, entry):
    _client.table("activity_log").insert(
        {
            "project_id": project_id,
            "ticket_id": entry.get("ticketId"),
            "from": entry.get("from"),
            "to": entry.get("to"),
            "event": entry["event"],
            "branch": entry.get("branch"),
            "actor": entry["actor"],
            "at": entry.get("at"),
        }
    ).execute()


def update_ticket(project_id, ticket_id, status=None, last_updated=None):
    """Persist a field change to a ticket. Used by kanban.py, which previously
    relied on mutating an in-memory dict by reference — that pattern doesn't
    apply against a real datastore, so callers must go through this instead."""
    updates = {}
    if status is not None:
        updates["status"] = status
    if last_updated is not None:
        updates["last_updated"] = last_updated
    if not updates:
        return find_ticket(project_id, ticket_id)
    resp = (
        _client.table("tickets")
        .update(updates)
        .eq("project_id", project_id)
        .eq("id", ticket_id)
        .execute()
    )
    if not resp.data:
        raise KeyError(f"Unknown ticket '{ticket_id}' in project '{project_id}'")
    return _ticket_from_row(resp.data[0])


def reset_project(project_id):
    resp = _client.table("projects").select("is_seed").eq("id", project_id).execute()
    if not resp.data:
        raise KeyError(f"Unknown project '{project_id}'")
    if not resp.data[0]["is_seed"]:
        raise ValueError(f"Project '{project_id}' has no seed data to reset to")

    seed_resp = _client.table("seed_tickets").select("ticket_data").eq("project_id", project_id).execute()
    seed_tickets = [row["ticket_data"] for row in seed_resp.data]

    _client.table("tickets").delete().eq("project_id", project_id).execute()
    if seed_tickets:
        _client.table("tickets").insert([_ticket_row(project_id, t) for t in seed_tickets]).execute()
    _client.table("activity_log").delete().eq("project_id", project_id).execute()

    return get_project(project_id)


def find_ticket(project_id, ticket_id):
    resp = (
        _client.table("tickets")
        .select("*")
        .eq("project_id", project_id)
        .eq("id", ticket_id)
        .execute()
    )
    if not resp.data:
        raise KeyError(f"Unknown ticket '{ticket_id}' in project '{project_id}'")
    return _ticket_from_row(resp.data[0])


def is_user_created(project_id):
    resp = _client.table("projects").select("is_seed").eq("id", project_id).execute()
    if not resp.data:
        return True
    return not resp.data[0]["is_seed"]


def _slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


def _project_exists(project_id):
    resp = _client.table("projects").select("id").eq("id", project_id).limit(1).execute()
    return bool(resp.data)


def _unique_id(name):
    base = _slugify(name)
    candidate = base
    n = 2
    while _project_exists(candidate):
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def create_project(name, team_slug, sprint_name, start_date, end_date, prefix, tickets, channel=None):
    """Create + persist a new project. Returns the created project dict."""
    project_id = _unique_id(name)
    total_committed = sum(t.get("storyPoints", 0) for t in tickets)
    points_done = sum(t.get("storyPoints", 0) for t in tickets if t.get("status") == "Done")

    seen_emails = set()
    team_members = []
    for ticket in tickets:
        assignee = ticket.get("assignee") or {}
        email = assignee.get("email")
        if email and email not in seen_emails:
            team_members.append({"email": email, "name": assignee.get("name", email), "role": "Engineer"})
            seen_emails.add(email)

    _client.rpc(
        "create_project_with_tickets",
        {
            "p_id": project_id,
            "p_name": name,
            "p_team_slug": team_slug,
            "p_channel": channel or team_slug,
            "p_sprint_name": sprint_name,
            "p_start_date": start_date,
            "p_end_date": end_date,
            "p_total_committed": total_committed,
            "p_points_done": points_done,
            "p_prefix": prefix,
            "p_tickets": tickets,
            "p_team_members": team_members,
        },
    ).execute()

    return get_project(project_id)


def delete_project(project_id):
    resp = _client.table("projects").select("is_seed").eq("id", project_id).execute()
    if not resp.data:
        raise KeyError(f"Unknown project '{project_id}'")
    if resp.data[0]["is_seed"]:
        raise ValueError("Seed projects cannot be deleted")
    # Cascades remove tickets/health_history/activity_log/slack_config rows too.
    _client.table("projects").delete().eq("id", project_id).execute()
