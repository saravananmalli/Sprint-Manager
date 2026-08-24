"""Velocity math, sprint status, health score, and trend computation
(§11.1, §11.2, §11.4, §11.5) plus health_history.json persistence (§11.8, §14.2)."""

import json
import os
from datetime import date, datetime, timezone

from filelock import FileLock

HISTORY_PATH = os.path.join(os.path.dirname(__file__), "health_history.json")
LOCK_PATH = HISTORY_PATH + ".lock"
MAX_HISTORY_ENTRIES = 30


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


def load_history(project_id=None):
    if not os.path.exists(HISTORY_PATH):
        return []
    with open(HISTORY_PATH, "r") as f:
        history = json.load(f)
    if project_id is not None:
        history = [h for h in history if h.get("projectId") == project_id]
    return history


def save_health_entry(entry):
    """Insert/overwrite today's entry for this project, sort ascending by
    date, prune to MAX_HISTORY_ENTRIES, and write back under a file lock
    (§11.8). Entries are keyed by (date, projectId) so same-day runs from
    different projects don't clobber each other."""
    with FileLock(LOCK_PATH, timeout=10):
        history = load_history()
        history = [
            h for h in history
            if not (h["date"] == entry["date"] and h.get("projectId") == entry.get("projectId"))
        ]
        history.append(entry)
        history.sort(key=lambda h: h["date"])
        history = history[-MAX_HISTORY_ENTRIES:]
        with open(HISTORY_PATH, "w") as f:
            json.dump(history, f, indent=2)
    return history
