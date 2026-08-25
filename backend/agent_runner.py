"""6-step pipeline orchestration, scoped to a single project + CLI entry point."""

import argparse
import json
import logging
import os
import uuid
from datetime import date, datetime, timezone

from dotenv import load_dotenv

# Must run before importing our own modules: health_score/projects_store/
# runtime_settings read SUPABASE_URL etc. from os.environ at import time.
# Needed here (not just in main.py) since this file also runs standalone
# via `python agent_runner.py ...`, which doesn't go through main.py first.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import health_score
import jira_client
import nudge_generator
import projects_store
import risk_engine
import runtime_settings
import slack_sender
import summary_generator

logger = logging.getLogger("sprint_agent")

STEPS = ["risk", "nudge", "summary", "health", "all"]


def build_sprint_snapshot(project, now=None):
    """Steps 1–3: fetch tickets (live Jira or mock/seed), tag risk, compute
    velocity (deterministic, no LLM)."""
    now = now or datetime.now(timezone.utc)
    tickets, source = jira_client.load_tickets(project)
    tagged_tickets = risk_engine.tag_tickets(tickets, now=now, thresholds=runtime_settings.get_thresholds())

    if source == "live":
        total_committed = sum(t.get("storyPoints", 0) for t in tickets)
        points_done = sum(t.get("storyPoints", 0) for t in tickets if t.get("status") == "Done")
    else:
        total_committed = project["totalCommitted"]
        points_done = project["pointsDone"]

    sprint_meta = {**project, "totalCommitted": total_committed, "pointsDone": points_done}
    velocity = health_score.compute_velocity(sprint_meta, today=now.date())

    snapshot = {
        "sprintName": project["sprintName"],
        "startDate": project["startDate"],
        "endDate": project["endDate"],
        "totalCommitted": total_committed,
        "pointsDone": points_done,
        "tickets": tagged_tickets,
        "ticketSource": source,
    }
    snapshot.update(velocity)
    return snapshot


def run_pipeline(project_id, steps=None, on_progress=None):
    """Run the full pipeline for one project and return {sprint, standup,
    nudges, health}. `on_progress(step_name, pct)` fires after each step.
    A single step failing is caught and logged; the run continues (§22.2)."""
    steps = steps or ["all"]
    run_all = "all" in steps

    def report(step_name, pct):
        logger.info(json.dumps({"event": "step_completed", "step": step_name, "progress": pct}))
        if on_progress:
            on_progress(step_name, pct)

    result = {"sprint": None, "standup": None, "nudges": [], "health": None, "partial": False, "errors": []}

    report("Fetching sprint data", 10)
    project = projects_store.get_project(project_id)

    report("Analysing risks", 30)
    snapshot = build_sprint_snapshot(project)
    result["sprint"] = snapshot

    if run_all or "nudge" in steps:
        report("Generating nudges", 55)
        try:
            # generate_nudges falls back to deterministic text per-owner on
            # Claude failure, so it always returns full coverage — this only
            # catches truly unexpected errors (e.g. malformed sprint data).
            result["nudges"] = nudge_generator.generate_nudges(snapshot)
        except Exception as exc:  # noqa: BLE001
            logger.warning(json.dumps({"event": "step_failed", "step": "nudge", "error": str(exc)}))
            result["partial"] = True
            result["errors"].append(f"Nudge generation failed: {exc}")

    if run_all or "summary" in steps:
        report("Writing standup summary", 75)
        try:
            # generate_standup falls back to a deterministic digest on
            # Claude failure, so it always returns text.
            result["standup"] = summary_generator.generate_standup(snapshot)
        except Exception as exc:  # noqa: BLE001
            logger.warning(json.dumps({"event": "step_failed", "step": "summary", "error": str(exc)}))
            result["partial"] = True
            result["errors"].append(f"Standup summary failed: {exc}")

    if run_all or "health" in steps:
        report("Scoring health", 90)
        try:
            health = health_score.compute_health_score(snapshot["tickets"])
            entry = {
                "date": date.today().isoformat(),
                "projectId": project_id,
                "score": health["score"],
                "components": health["components"],
                "sprintStatus": snapshot["sprintStatus"],
                "ticketsAtRisk": sum(1 for t in snapshot["tickets"] if t["riskTags"]),
                "runId": str(uuid.uuid4()),
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            health_score.save_health_entry(entry)
            result["health"] = entry
        except Exception as exc:  # noqa: BLE001
            logger.warning(json.dumps({"event": "step_failed", "step": "health", "error": str(exc)}))
            result["partial"] = True
            result["errors"].append(f"Health scoring failed: {exc}")

    report("Done", 100)
    return result


def post_to_slack(result, project_id, post_type="all"):
    posted = 0
    skipped = 0
    enabled = slack_sender.slack_enabled()
    project = projects_store.get_project(project_id)

    if post_type in ("all",) and result.get("health"):
        health = result["health"]
        trend = health_score.compute_trend(health_score.load_history(project_id))
        ok = slack_sender.send_health_score(project["name"], health["score"], trend, health["sprintStatus"])
        posted += 1 if ok else 0
        skipped += 0 if ok else 1

    if post_type in ("standup", "all") and result.get("standup"):
        ok = slack_sender.send_standup(result["standup"])
        posted += 1 if ok else 0
        skipped += 0 if ok else 1

    if post_type in ("nudges", "all"):
        for nudge in result.get("nudges", []):
            ok = slack_sender.send_nudge(f"{nudge['assignee']['name']} — {nudge['message']}")
            posted += 1 if ok else 0
            skipped += 0 if ok else 1

    if not enabled:
        logger.info(json.dumps({"event": "slack_disabled"}))

    return {"posted": posted, "skipped": skipped, "slackEnabled": enabled}


def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=projects_store.default_project_id())
    parser.add_argument("--step", choices=STEPS, default="all")
    args = parser.parse_args()

    logger.info(json.dumps({"event": "run_started", "project": args.project}))
    result = run_pipeline(args.project, steps=[args.step])
    print(json.dumps({
        "sprint": {k: v for k, v in result["sprint"].items() if k != "tickets"},
        "ticketCount": len(result["sprint"]["tickets"]),
        "standup": result["standup"],
        "nudgeCount": len(result["nudges"]),
        "health": result["health"],
        "partial": result["partial"],
    }, indent=2, default=str))

    slack_result = post_to_slack(result, args.project, "all")
    if not slack_result["slackEnabled"]:
        print("Slack disabled — no webhook configured")
    logger.info(json.dumps({"event": "run_completed", "partial": result["partial"]}))


if __name__ == "__main__":
    main()
