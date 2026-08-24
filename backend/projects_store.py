"""In-memory multi-project store, seeded from projects_data.json plus any
user-created projects persisted in user_projects.json.

Mutations (kanban moves, automation events) happen in memory only;
`reset_project` reloads a project's tickets from the seed file. Project
*creation*/*deletion* (§ "project persistence") is persisted to disk so
projects created via the UI survive a backend restart.
"""

import copy
import json
import os
import re

from filelock import FileLock

DATA_PATH = os.path.join(os.path.dirname(__file__), "projects_data.json")
USER_PROJECTS_PATH = os.path.join(os.path.dirname(__file__), "user_projects.json")
USER_PROJECTS_LOCK = USER_PROJECTS_PATH + ".lock"

with open(DATA_PATH, "r") as f:
    _SEED = json.load(f)

_projects = {p["id"]: copy.deepcopy(p) for p in _SEED["projects"]}
_seed_ids = set(_projects.keys())
_team = copy.deepcopy(_SEED["team"])
_activity_log = {pid: [] for pid in _projects}


def _load_user_projects():
    if not os.path.exists(USER_PROJECTS_PATH):
        return []
    with open(USER_PROJECTS_PATH, "r") as f:
        return json.load(f)


def _save_user_projects(projects):
    with open(USER_PROJECTS_PATH, "w") as f:
        json.dump(projects, f, indent=2)


for _p in _load_user_projects():
    _projects[_p["id"]] = _p
    _activity_log.setdefault(_p["id"], [])


def list_project_ids():
    return list(_projects.keys())


def get_project(project_id):
    if project_id not in _projects:
        raise KeyError(f"Unknown project '{project_id}'")
    return _projects[project_id]


def default_project_id():
    return next(iter(_projects))


def all_projects():
    return list(_projects.values())


def get_team():
    return _team


def get_activity_log(project_id):
    return _activity_log.setdefault(project_id, [])


def append_activity(project_id, entry):
    log = _activity_log.setdefault(project_id, [])
    log.insert(0, entry)
    _activity_log[project_id] = log[:50]


def reset_project(project_id):
    if project_id not in _seed_ids:
        raise ValueError(f"Project '{project_id}' has no seed data to reset to")
    seed = next(p for p in _SEED["projects"] if p["id"] == project_id)
    _projects[project_id] = copy.deepcopy(seed)
    _activity_log[project_id] = []
    return _projects[project_id]


def find_ticket(project_id, ticket_id):
    project = get_project(project_id)
    for ticket in project["tickets"]:
        if ticket["id"] == ticket_id:
            return ticket
    raise KeyError(f"Unknown ticket '{ticket_id}' in project '{project_id}'")


def is_user_created(project_id):
    return project_id not in _seed_ids


def _slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "project"


def _unique_id(name):
    base = _slugify(name)
    candidate = base
    n = 2
    while candidate in _projects:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def create_project(name, team_slug, sprint_name, start_date, end_date, prefix, tickets, channel=None):
    """Create + persist a new project. Returns the created project dict."""
    project_id = _unique_id(name)
    total_committed = sum(t.get("storyPoints", 0) for t in tickets)
    points_done = sum(t.get("storyPoints", 0) for t in tickets if t.get("status") == "Done")

    project = {
        "id": project_id,
        "name": name,
        "teamSlug": team_slug,
        "channel": channel or team_slug,
        "sprintName": sprint_name,
        "startDate": start_date,
        "endDate": end_date,
        "totalCommitted": total_committed,
        "pointsDone": points_done,
        "prefix": prefix,
        "tickets": tickets,
    }

    with FileLock(USER_PROJECTS_LOCK, timeout=10):
        stored = _load_user_projects()
        stored.append(project)
        _save_user_projects(stored)

    _projects[project_id] = project
    _activity_log[project_id] = []

    seen_emails = {m["email"] for m in _team}
    for ticket in tickets:
        assignee = ticket.get("assignee") or {}
        email = assignee.get("email")
        if email and email not in seen_emails:
            _team.append({"name": assignee.get("name", email), "email": email, "role": "Engineer"})
            seen_emails.add(email)

    return project


def delete_project(project_id):
    if project_id not in _projects:
        raise KeyError(f"Unknown project '{project_id}'")
    if project_id in _seed_ids:
        raise ValueError("Seed projects cannot be deleted")

    with FileLock(USER_PROJECTS_LOCK, timeout=10):
        stored = [p for p in _load_user_projects() if p["id"] != project_id]
        _save_user_projects(stored)

    del _projects[project_id]
    _activity_log.pop(project_id, None)
