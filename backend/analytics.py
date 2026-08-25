"""Risk distribution, per-assignee load, and a velocity forecast series."""

from datetime import datetime, timedelta, timezone

import health_score
import projects_store
import risk_engine
import runtime_settings

RISK_LABELS = {
    "STALE": "Stale",
    "STUCK": "Stuck",
    "BLOCKED": "Blocked",
    "UNASSIGNED": "Unassigned",
    "INCOMPLETE_AC": "No AC",
}


def risk_distribution(tickets):
    counts = {}
    for t in tickets:
        for tag in t["riskTags"]:
            label = RISK_LABELS.get(tag, tag)
            counts[label] = counts.get(label, 0) + 1
    return [{"label": label, "count": count} for label, count in counts.items()]


def points_per_assignee(tickets):
    by_assignee = {}
    for t in tickets:
        name = t.get("assignee", {}).get("name") or "Unassigned"
        bucket = by_assignee.setdefault(name, {"assignee": name, "done": 0, "inProgress": 0})
        if t["status"] == "Done":
            bucket["done"] += t["storyPoints"]
        else:
            bucket["inProgress"] += t["storyPoints"]
    rows = list(by_assignee.values())
    rows.sort(key=lambda r: r["done"] + r["inProgress"], reverse=True)
    return rows


def velocity_prediction(project, now=None):
    now = now or datetime.now(timezone.utc)
    velocity = health_score.compute_velocity(project, today=now.date())
    history = health_score.load_history()

    series = []
    recent = history[-3:] if len(history) >= 1 else []
    for entry in recent:
        series.append({"date": entry["date"], "value": entry["score"], "kind": "actual"})
    if not series:
        series.append({"date": now.date().isoformat(), "value": velocity["velocity"], "kind": "actual"})

    last_value = series[-1]["value"] or 0
    days_remaining = max(velocity["daysRemaining"], 1)
    step = (0 - last_value) / (days_remaining + 5) if last_value else 0
    for i in range(1, 6):
        forecast_date = (now.date() + timedelta(days=i)).isoformat()
        value = max(round(last_value + step * i, 1), 0)
        series.append({"date": forecast_date, "value": value, "kind": "forecast"})

    return series


def build_analytics(project_id, now=None):
    now = now or datetime.now(timezone.utc)
    project = projects_store.get_project(project_id)
    tickets = risk_engine.tag_tickets(project["tickets"], now=now, thresholds=runtime_settings.get_thresholds())
    return {
        "riskDistribution": risk_distribution(tickets),
        "pointsPerAssignee": points_per_assignee(tickets),
        "velocityPrediction": velocity_prediction(project, now=now),
        "tickets": tickets,
    }
