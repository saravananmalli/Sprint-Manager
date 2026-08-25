"""Velocity math, sprint status, health score, and trend computation
(§11.1, §11.2, §11.4, §11.5) plus Supabase-backed health_history persistence
(§11.8, §14.2)."""

import os
from datetime import date

from supabase import create_client

MAX_HISTORY_ENTRIES = 30

_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _today():
    return date.today()


def compute_velocity(sprint, today=None):
    """Return daysElapsed, daysRemaining, velocity, projectedCompletion, sprintStatus."""
    today = today or _today()
    start = date.fromisoformat(sprint["startDate"])
    end = date.fromisoformat(sprint["endDate"])
    total_committed = sprint["totalCommitted"]
    points_done = sprint["pointsDone"]

    days_elapsed = max((min(today, end) - start).days, 0)
    days_remaining = max((end - max(today, start)).days, 0)

    velocity = (points_done / total_committed * 100) if total_committed else 0
    daily_burn_rate = (points_done / days_elapsed) if days_elapsed > 0 else 0
    projected_completion = daily_burn_rate * days_remaining + points_done

    if total_committed and projected_completion >= 0.9 * total_committed:
        sprint_status = "On Track"
    elif total_committed and projected_completion >= 0.7 * total_committed:
        sprint_status = "At Risk"
    elif total_committed:
        sprint_status = "Off Track"
    else:
        sprint_status = "On Track"

    return {
        "daysElapsed": days_elapsed,
        "daysRemaining": days_remaining,
        "velocity": round(velocity, 1),
        "projectedCompletion": round(projected_completion, 1),
        "sprintStatus": sprint_status,
    }


def compute_health_score(tickets):
    """Return {score, components} from a list of risk-tagged tickets, or
    {score: None, components: None} when there are no tickets (§11.4)."""
    total = len(tickets)
    if total == 0:
        return {"score": None, "components": None}

    done = sum(1 for t in tickets if t.get("status") == "Done")
    blocked = sum(1 for t in tickets if "BLOCKED" in t.get("riskTags", []))
    stale = sum(1 for t in tickets if "STALE" in t.get("riskTags", []))
    total_committed = sum(t.get("storyPoints", 0) for t in tickets)
    points_done = sum(t.get("storyPoints", 0) for t in tickets if t.get("status") == "Done")

    velocity_score = min((points_done / total_committed * 100) if total_committed else 0, 100)
    blocker_score = 100 - (blocked / total * 100)
    staleness_score = 100 - (stale / total * 100)
    completion_score = done / total * 100

    score = round(
        velocity_score * 0.35
        + blocker_score * 0.25
        + staleness_score * 0.25
        + completion_score * 0.15
    )
    score = max(0, min(100, score))

    return {
        "score": score,
        "components": {
            "velocityScore": round(velocity_score),
            "blockerScore": round(blocker_score),
            "stalenessScore": round(staleness_score),
            "completionScore": round(completion_score),
        },
    }


def compute_trend(history):
    """History is a list of {date, score} sorted ascending. Uses the last
    two entries per §11.5. Fewer than 2 entries → Stable."""
    scored = [h for h in history if h.get("score") is not None]
    if len(scored) < 2:
        return "Stable"
    latest = scored[-1]["score"]
    previous = scored[-2]["score"]
    if latest > previous + 5:
        return "Improving"
    if latest < previous - 5:
        return "Declining"
    return "Stable"


def _history_entry_from_row(row):
    return {
        "date": row["date"],
        "projectId": row["project_id"],
        "score": row.get("score"),
        "components": {
            "velocityScore": row.get("velocity_score"),
            "blockerScore": row.get("blocker_score"),
            "stalenessScore": row.get("staleness_score"),
            "completionScore": row.get("completion_score"),
        },
        "sprintStatus": row.get("sprint_status"),
        "ticketsAtRisk": row.get("tickets_at_risk"),
        "runId": row.get("run_id"),
        "createdAt": row.get("created_at"),
    }


def load_history(project_id=None):
    query = _client.table("health_history").select("*").order("date")
    if project_id is not None:
        query = query.eq("project_id", project_id)
    resp = query.execute()
    return [_history_entry_from_row(r) for r in resp.data]


def save_health_entry(entry):
    """Upsert today's entry for this project (keyed on (project_id, date) so
    same-day runs from different projects don't clobber each other), then
    prune that project's history to MAX_HISTORY_ENTRIES — a per-project cap,
    not the legacy JSON file's global-across-all-projects cap."""
    components = entry.get("components") or {}
    project_id = entry["projectId"]
    row = {
        "project_id": project_id,
        "date": entry["date"],
        "score": entry.get("score"),
        "velocity_score": components.get("velocityScore"),
        "blocker_score": components.get("blockerScore"),
        "staleness_score": components.get("stalenessScore"),
        "completion_score": components.get("completionScore"),
        "sprint_status": entry.get("sprintStatus"),
        "tickets_at_risk": entry.get("ticketsAtRisk"),
        "run_id": entry.get("runId"),
    }
    if entry.get("createdAt"):
        row["created_at"] = entry["createdAt"]
    _client.table("health_history").upsert(row, on_conflict="project_id,date").execute()

    kept = (
        _client.table("health_history")
        .select("id")
        .eq("project_id", project_id)
        .order("date", desc=True)
        .limit(MAX_HISTORY_ENTRIES)
        .execute()
    )
    keep_ids = {r["id"] for r in kept.data}
    all_ids = (
        _client.table("health_history")
        .select("id")
        .eq("project_id", project_id)
        .execute()
    )
    stale_ids = [r["id"] for r in all_ids.data if r["id"] not in keep_ids]
    if stale_ids:
        _client.table("health_history").delete().in_("id", stale_ids).execute()

    return load_history(project_id)
