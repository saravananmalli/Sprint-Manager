"""Per-member workload, risk insight, and today's-tasks aggregation.

Insight text is deterministic (rule-based off risk tags), not an LLM
call — keeps the Team page fast and reliable for a roster this size,
matching the same risk vocabulary the risk engine already produces.
"""

from datetime import date

import health_score
import projects_store
import risk_engine
import runtime_settings
import slack_sender

REASON_TEMPLATES = {
    "STALE": lambda n: f"{n} stale ticket(s) (>24h without update)",
    "STUCK": lambda n: f"{n} stuck In Progress (past half the sprint)",
    "BLOCKED": lambda n: f"{n} blocked ticket(s)",
    "INCOMPLETE_AC": lambda n: f"{n} ticket(s) missing acceptance criteria",
}

ACTION_TEMPLATES = {
    "STALE": "Request a status update on the stale tickets",
    "STUCK": "Pair on the stuck items or split into smaller tickets",
    "BLOCKED": "Escalate the blocker owner for an unblock ETA",
    "INCOMPLETE_AC": "Ask the engineer to fill in acceptance criteria before continuing",
}


def _member_tickets(project, email):
    return [t for t in project["tickets"] if t.get("assignee", {}).get("email") == email]


def _tag_projects_for_member(email):
    return [p["name"] for p in projects_store.all_projects() if _member_tickets(p, email)]


def _recent_activity(email, projects, limit=5):
    """Kanban activity entries for tickets this member owns, newest first,
    across every project passed in (already scoped by the caller)."""
    events = []
    for project in projects:
        owned_ids = {t["id"] for t in _member_tickets(project, email)}
        for entry in projects_store.get_activity_log(project["id"]):
            if entry["ticketId"] in owned_ids:
                events.append({**entry, "projectName": project["name"]})
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]


def _nudges_received(email, projects, latest_results, limit=5):
    """Nudges from the most recent agent run of each project that were
    addressed to this member. `latest_results` is main.py's in-memory
    run-result cache, keyed by project id — passed in rather than imported
    to avoid a circular import."""
    if not latest_results:
        return []
    received = []
    for project in projects:
        result = latest_results.get(project["id"])
        if not result:
            continue
        for nudge in result.get("nudges", []):
            if nudge.get("assignee", {}).get("email") == email:
                received.append({
                    **nudge,
                    "projectName": project["name"],
                    "teamSlug": project["teamSlug"],
                    "generatedAt": result.get("generatedAt"),
                    "loggedOnly": not slack_sender.slack_enabled(),
                })
    received.sort(key=lambda n: n.get("generatedAt") or "", reverse=True)
    return received[:limit]


def member_summary(email, project_id=None, latest_results=None):
    projects = [projects_store.get_project(project_id)] if project_id else projects_store.all_projects()
    thresholds = runtime_settings.get_thresholds()
    tickets = []
    for project in projects:
        tickets.extend(risk_engine.tag_tickets(_member_tickets(project, email), thresholds=thresholds))

    done = sum(1 for t in tickets if t["status"] == "Done")
    points_done = sum(t["storyPoints"] for t in tickets if t["status"] == "Done")
    points_total = sum(t["storyPoints"] for t in tickets)
    velocity = round(points_done / points_total * 100) if points_total else 0

    at_risk_tickets = [t for t in tickets if t["riskTags"]]
    tag_counts = {}
    for t in at_risk_tickets:
        for tag in t["riskTags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    reasons = [REASON_TEMPLATES[tag](count) for tag, count in tag_counts.items() if tag in REASON_TEMPLATES]
    actions = [ACTION_TEMPLATES[tag] for tag in tag_counts if tag in ACTION_TEMPLATES]

    risk_count = len(at_risk_tickets)
    risk_level = "HIGH" if risk_count >= 3 else "MEDIUM" if risk_count >= 1 else "LOW"

    today_tasks = [t for t in tickets if t["status"] not in ("Done", "Todo", "Backlog")]

    return {
        "riskLevel": risk_level,
        "velocity": velocity,
        "pointsDone": points_done,
        "pointsTotal": points_total,
        "ticketsDone": done,
        "ticketsTotal": len(tickets),
        "staleCount": tag_counts.get("STALE", 0),
        "stuckCount": tag_counts.get("STUCK", 0),
        "reasons": reasons,
        "suggestedActions": actions,
        "todayTasks": today_tasks,
        "recentActivity": _recent_activity(email, projects),
        "nudgesReceived": _nudges_received(email, projects, latest_results),
    }


def list_team(project_id=None, latest_results=None):
    roster = []
    for member in projects_store.get_team():
        member_projects = _tag_projects_for_member(member["email"])
        summary = member_summary(member["email"], project_id=project_id, latest_results=latest_results)
        roster.append({**member, "projects": member_projects, **summary})
    return roster
