"""One-time (idempotent) load of existing JSON-file data into Supabase.

Run after applying 0001_init_schema.sql:

    cd backend && .venv/bin/python migrations/seed_supabase.py

Safe to re-run — every insert is an upsert keyed on the same identity the
JSON files used (project id, ticket (project_id, id), team member email,
health_history (project_id, date), settings key).
"""
import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _path(name):
    return os.path.join(BACKEND_DIR, name)


def _load_json(name, default):
    path = _path(name)
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def ticket_row(project_id, ticket):
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


def project_row(project, is_seed):
    return {
        "id": project["id"],
        "name": project["name"],
        "team_slug": project["teamSlug"],
        "channel": project.get("channel") or project["teamSlug"],
        "sprint_name": project["sprintName"],
        "start_date": project["startDate"],
        "end_date": project["endDate"],
        "total_committed": project.get("totalCommitted", 0),
        "points_done": project.get("pointsDone", 0),
        "prefix": project["prefix"],
        "jira_board_id": project.get("jiraBoardId"),
        "jira_sprint_id": project.get("jiraSprintId"),
        "is_seed": is_seed,
    }


def main():
    seed_data = _load_json("projects_data.json", {"projects": [], "team": []})
    user_projects = _load_json("user_projects.json", [])
    health_history = _load_json("health_history.json", [])
    slack_state = _load_json("slack_config.json", {"lastRun": {}})

    team_by_email = {}
    for member in seed_data.get("team", []):
        if member.get("email"):
            team_by_email[member["email"]] = member

    print(f"Seed projects: {len(seed_data.get('projects', []))}")
    print(f"User projects: {len(user_projects)}")
    print(f"Health history entries: {len(health_history)}")

    # 1. Seed projects + their tickets + a read-only seed_tickets snapshot.
    for project in seed_data.get("projects", []):
        client.table("projects").upsert(project_row(project, is_seed=True)).execute()

        tickets = project.get("tickets", [])
        if tickets:
            client.table("tickets").upsert(
                [ticket_row(project["id"], t) for t in tickets]
            ).execute()
            client.table("seed_tickets").delete().eq("project_id", project["id"]).execute()
            client.table("seed_tickets").insert(
                [{"project_id": project["id"], "ticket_data": t} for t in tickets]
            ).execute()

        for t in tickets:
            assignee = t.get("assignee") or {}
            if assignee.get("email"):
                team_by_email[assignee["email"]] = assignee

    # 2. User-created projects (not seed, no seed_tickets snapshot).
    for project in user_projects:
        client.table("projects").upsert(project_row(project, is_seed=False)).execute()
        tickets = project.get("tickets", [])
        if tickets:
            client.table("tickets").upsert(
                [ticket_row(project["id"], t) for t in tickets]
            ).execute()
        for t in tickets:
            assignee = t.get("assignee") or {}
            if assignee.get("email"):
                team_by_email[assignee["email"]] = assignee

    # 3. Team members, deduped by email (mirrors projects_store.create_project's dedup).
    if team_by_email:
        client.table("team_members").upsert(
            [
                {
                    "email": email,
                    "name": m.get("name", email),
                    "role": m.get("role", "Engineer"),
                }
                for email, m in team_by_email.items()
            ]
        ).execute()
    print(f"Team members: {len(team_by_email)}")

    # 4. Health history — split nested `components` into flat columns,
    # applying the per-project 30-cap fix as we go (dedupe here; the app's
    # own save_health_entry enforces the cap on future writes).
    if health_history:
        rows = []
        for entry in health_history:
            components = entry.get("components", {})
            rows.append(
                {
                    "project_id": entry["projectId"],
                    "date": entry["date"],
                    "score": entry.get("score"),
                    "velocity_score": components.get("velocityScore"),
                    "blocker_score": components.get("blockerScore"),
                    "staleness_score": components.get("stalenessScore"),
                    "completion_score": components.get("completionScore"),
                    "sprint_status": entry.get("sprintStatus"),
                    "tickets_at_risk": entry.get("ticketsAtRisk"),
                    "run_id": entry.get("runId"),
                    "created_at": entry.get("createdAt"),
                }
            )
        client.table("health_history").upsert(rows, on_conflict="project_id,date").execute()

    # 5. Slack lastRun state.
    last_run = slack_state.get("lastRun", {})
    if last_run:
        client.table("slack_config").upsert(
            [{"project_id": pid, "last_run_at": ts} for pid, ts in last_run.items()]
        ).execute()

    # 6. Runtime settings — load live values from backend/.env (not hardcoded
    # defaults), falling back to .env.example if a key is unset.
    editable_defaults = {
        "USE_MOCK_DATA": "true",
        "STALE_THRESHOLD_HOURS": "24",
        "STUCK_THRESHOLD_PCT": "50",
        "SPRINT_TOTAL_DAYS": "10",
    }
    settings_rows = [
        {"key": key, "value": os.environ.get(key, default)}
        for key, default in editable_defaults.items()
    ]
    client.table("runtime_settings").upsert(settings_rows).execute()
    print(f"Runtime settings: {[r['key'] for r in settings_rows]}")

    print("Done.")


if __name__ == "__main__":
    main()
