"""Risk tagging for sprint tickets. Thresholds are read from the environment
at call time (never hardcoded) per the risk tag rules in the spec (§11.3)."""

import os
from datetime import datetime, timezone


def _now():
    return datetime.now(timezone.utc)


def _parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _thresholds():
    return {
        "stale_hours": float(os.environ.get("STALE_THRESHOLD_HOURS", 24)),
        "stuck_pct": float(os.environ.get("STUCK_THRESHOLD_PCT", 50)),
        "sprint_total_days": float(os.environ.get("SPRINT_TOTAL_DAYS", 10)),
    }


def tag_ticket(ticket, now=None, thresholds=None):
    """Return the list of risk tags that apply to a single ticket."""
    now = now or _now()
    thresholds = thresholds or _thresholds()
    tags = []

    status = ticket.get("status")
    last_updated = _parse(ticket["lastUpdated"])
    created_at = _parse(ticket["createdAt"])

    hours_since_update = (now - last_updated).total_seconds() / 3600
    if hours_since_update > thresholds["stale_hours"] and status != "Done":
        tags.append("STALE")

    age_days = (now - created_at).total_seconds() / 86400
    stuck_threshold_days = thresholds["stuck_pct"] / 100 * thresholds["sprint_total_days"]
    if status == "In Progress" and age_days > stuck_threshold_days:
        tags.append("STUCK")

    assignee = ticket.get("assignee")
    if not assignee or not assignee.get("name"):
        tags.append("UNASSIGNED")

    if ticket.get("blockers"):
        tags.append("BLOCKED")

    ac = ticket.get("acceptanceCriteria")
    if not ac or len(ac) < 20:
        tags.append("INCOMPLETE_AC")

    return tags


def tag_tickets(tickets, now=None, thresholds=None):
    """Return a new list of tickets, each with a `riskTags` field populated."""
    now = now or _now()
    thresholds = thresholds or _thresholds()
    tagged = []
    for ticket in tickets:
        t = dict(ticket)
        t["riskTags"] = tag_ticket(ticket, now=now, thresholds=thresholds)
        tagged.append(t)
    return tagged
