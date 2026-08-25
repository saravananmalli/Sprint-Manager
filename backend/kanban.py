"""Kanban board assembly + git-webhook-style automation rules.

`simulate_event` mimics what a real git webhook handler would do: look
at the event type, find an eligible ticket, and apply the same status
transition a live webhook would trigger. Nothing here talks to a real
git host — the "Simulate" buttons in the UI call this directly instead
of a webhook receiver, but the transition logic is identical either way.
"""

from datetime import datetime, timezone

import projects_store
import risk_engine
import runtime_settings

COLUMNS = ["Backlog", "In Progress", "Testing", "In Review", "Done"]

_STATUS_TO_COLUMN = {
    "Todo": "Backlog",
    "Backlog": "Backlog",
    "In Progress": "In Progress",
    "Testing": "Testing",
    "In Review": "In Review",
    "Done": "Done",
}

AUTOMATION_RULES = [
    {"event": "git.push", "from": "In Progress", "to": "Testing", "description": "Push referencing a ticket → Testing"},
    {"event": "git.pr_opened", "from": "Testing", "to": "In Review", "description": "PR opened referencing a ticket → In Review"},
    {"event": "git.pr_merged", "from": "In Review", "to": "Done", "description": "PR merged referencing a ticket → Done"},
    {"event": "ci.passed", "from": "Testing", "to": "In Review", "description": "CI passed on a Testing ticket → In Review"},
]

_RULE_BY_EVENT = {r["event"]: r for r in AUTOMATION_RULES}


def column_for(status):
    return _STATUS_TO_COLUMN.get(status, "Backlog")


def build_board(project_id):
    project = projects_store.get_project(project_id)
    thresholds = runtime_settings.get_thresholds()
    board = {col: [] for col in COLUMNS}
    for ticket in risk_engine.tag_tickets(project["tickets"], thresholds=thresholds):
        board[column_for(ticket["status"])].append(ticket)
    return {
        "columns": [{"name": col, "tickets": board[col]} for col in COLUMNS],
        "automationRules": AUTOMATION_RULES,
        "activity": projects_store.get_activity_log(project_id),
    }


def simulate_event(project_id, event, ticket_id=None, actor="demo-bot"):
    rule = _RULE_BY_EVENT.get(event)
    if not rule:
        raise ValueError(f"Unknown automation event '{event}'")

    project = projects_store.get_project(project_id)

    ticket = None
    if ticket_id:
        ticket = projects_store.find_ticket(project_id, ticket_id)
        if column_for(ticket["status"]) != rule["from"]:
            raise ValueError(f"Ticket {ticket_id} is not in {rule['from']}")
    else:
        for t in project["tickets"]:
            if column_for(t["status"]) == rule["from"]:
                ticket = t
                break
        if ticket is None:
            raise ValueError(f"No ticket currently in {rule['from']} to advance")

    from_column = column_for(ticket["status"])
    last_updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ticket = projects_store.update_ticket(project_id, ticket["id"], status=rule["to"], last_updated=last_updated)

    branch = f"feature/{ticket['id'].lower()}-{ticket['summary'].lower().replace(' ', '-')[:32]}"
    entry = {
        "ticketId": ticket["id"],
        "from": from_column,
        "to": rule["to"],
        "event": event,
        "branch": branch,
        "actor": actor,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    projects_store.append_activity(project_id, entry)
    return {"ticket": ticket, "activity": entry}


def apply_webhook_event(project_id, event, ticket_ids, actor="webhook"):
    """Apply an automation rule to a specific set of tickets, as a real git
    host webhook would (identifies tickets by ID, unlike `simulate_event`
    which picks the first eligible one for the demo buttons). Ineligible or
    unknown ticket ids are skipped and reported rather than raising, since
    a single webhook payload can reference tickets in mixed states."""
    rule = _RULE_BY_EVENT.get(event)
    if not rule:
        raise ValueError(f"Unknown automation event '{event}'")

    project = projects_store.get_project(project_id)
    applied = []
    skipped = []

    for ticket_id in ticket_ids:
        try:
            ticket = projects_store.find_ticket(project_id, ticket_id)
        except KeyError:
            skipped.append({"ticketId": ticket_id, "reason": "unknown ticket"})
            continue

        from_column = column_for(ticket["status"])
        if from_column != rule["from"]:
            skipped.append({"ticketId": ticket_id, "reason": f"not in {rule['from']} (currently {from_column})"})
            continue

        last_updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        ticket = projects_store.update_ticket(project_id, ticket["id"], status=rule["to"], last_updated=last_updated)
        entry = {
            "ticketId": ticket["id"],
            "from": from_column,
            "to": rule["to"],
            "event": event,
            "branch": None,
            "actor": actor,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        projects_store.append_activity(project_id, entry)
        applied.append(entry)

    return {"applied": applied, "skipped": skipped}


def move_ticket(project_id, ticket_id, to_column, actor="you"):
    if to_column not in COLUMNS:
        raise ValueError(f"Unknown column '{to_column}'")
    ticket = projects_store.find_ticket(project_id, ticket_id)
    from_column = column_for(ticket["status"])
    new_status = "Backlog" if to_column == "Backlog" else to_column
    last_updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ticket = projects_store.update_ticket(project_id, ticket["id"], status=new_status, last_updated=last_updated)

    entry = {
        "ticketId": ticket["id"],
        "from": from_column,
        "to": to_column,
        "event": "manual.move",
        "branch": None,
        "actor": actor,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    projects_store.append_activity(project_id, entry)
    return {"ticket": ticket, "activity": entry}
