"""Live Jira connector, with graceful fallback to the in-memory project's
seed/mock tickets when live config is missing or the API call fails.

Multi-project: a project may set its own `jiraBoardId` / `jiraSprintId` in
projects_data.json / user_projects.json. If it doesn't, the global
JIRA_BOARD_ID / JIRA_SPRINT_ID env vars are used instead (single-board demo
setups). USE_MOCK_DATA=true (default) skips the network call entirely.
"""

import logging
import os

import requests

logger = logging.getLogger("sprint_agent")

_STATUS_MAP = {
    "to do": "Todo",
    "backlog": "Backlog",
    "in progress": "In Progress",
    "testing": "Testing",
    "in review": "In Review",
    "code review": "In Review",
    "done": "Done",
    "closed": "Done",
}


def _map_status(jira_status_name):
    return _STATUS_MAP.get((jira_status_name or "").strip().lower(), jira_status_name or "Backlog")


def _map_issue(issue, story_points_field, ac_field):
    fields = issue.get("fields", {})

    assignee_field = fields.get("assignee")
    assignee = (
        {"name": assignee_field.get("displayName", ""), "email": assignee_field.get("emailAddress", "")}
        if assignee_field
        else {"name": "", "email": ""}
    )

    blockers = []
    for link in fields.get("issuelinks", []):
        linked = link.get("inwardIssue") or link.get("outwardIssue")
        link_type = link.get("type", {}).get("name", "")
        if linked and "block" in link_type.lower():
            blockers.append(linked["key"])

    story_points = fields.get(story_points_field)

    return {
        "id": issue["key"],
        "summary": fields.get("summary", ""),
        "status": _map_status((fields.get("status") or {}).get("name")),
        "assignee": assignee,
        "storyPoints": int(story_points) if isinstance(story_points, (int, float)) else 0,
        "priority": (fields.get("priority") or {}).get("name"),
        "lastUpdated": fields.get("updated"),
        "createdAt": fields.get("created"),
        "blockers": blockers,
        "acceptanceCriteria": fields.get(ac_field) or "",
    }


def live_config_for(project):
    """Resolve (base_url, email, token, board_id, sprint_id) or None if
    live Jira isn't configured for this project."""
    if os.environ.get("USE_MOCK_DATA", "true").lower() == "true":
        return None

    base_url = os.environ.get("JIRA_BASE_URL")
    email = os.environ.get("JIRA_EMAIL")
    token = os.environ.get("JIRA_API_TOKEN")
    board_id = project.get("jiraBoardId") or os.environ.get("JIRA_BOARD_ID")
    sprint_id = project.get("jiraSprintId") or os.environ.get("JIRA_SPRINT_ID")

    if not (base_url and email and token and board_id and sprint_id):
        return None
    return base_url, email, token, board_id, sprint_id


def fetch_sprint_issues(base_url, email, token, board_id, sprint_id):
    """Call the Jira Agile REST API and return canonical-shape tickets.
    Raises requests.RequestException / ValueError on failure — callers
    should catch and fall back to mock data."""
    url = f"{base_url.rstrip('/')}/rest/agile/1.0/board/{board_id}/sprint/{sprint_id}/issue"
    story_points_field = os.environ.get("JIRA_STORY_POINTS_FIELD", "customfield_10016")
    ac_field = os.environ.get("JIRA_AC_FIELD", "customfield_10100")

    tickets = []
    start_at = 0
    while True:
        resp = requests.get(
            url,
            auth=(email, token),
            params={"startAt": start_at, "maxResults": 100, "fields": "*all"},
            timeout=15,
        )
        if resp.status_code == 401:
            raise PermissionError("Jira auth failed — check JIRA_EMAIL and JIRA_API_TOKEN")
        resp.raise_for_status()
        payload = resp.json()
        tickets.extend(_map_issue(issue, story_points_field, ac_field) for issue in payload.get("issues", []))
        start_at += len(payload.get("issues", []))
        if start_at >= payload.get("total", start_at) or not payload.get("issues"):
            break
    return tickets


def load_tickets(project):
    """Return (tickets, source) for `project`. `source` is "live" only when
    tickets actually came from the Jira API this call — callers that derive
    sprint totals from ticket data should only do so for "live", since the
    mock/seed totalCommitted is a curated scope, not simply sum(storyPoints)."""
    config = live_config_for(project)
    if not config:
        return project["tickets"], "mock"

    base_url, email, token, board_id, sprint_id = config
    try:
        tickets = fetch_sprint_issues(base_url, email, token, board_id, sprint_id)
        if not tickets:
            logger.warning("Jira returned zero issues for board=%s sprint=%s — using mock data", board_id, sprint_id)
            return project["tickets"], "mock"
        return tickets, "live"
    except PermissionError as exc:
        logger.error(str(exc))
    except requests.RequestException as exc:
        logger.error("Jira request failed (%s) — falling back to mock data", exc)
    except (ValueError, KeyError) as exc:
        logger.error("Jira response could not be parsed (%s) — falling back to mock data", exc)
    return project["tickets"], "mock"
