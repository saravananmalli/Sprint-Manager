"""Slack scheduler config, per-project channel mapping, and escalations."""

import os
from datetime import datetime, timezone

from supabase import create_client

import projects_store
import team_insights

_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _last_run_by_project():
    resp = _client.table("slack_config").select("*").execute()
    return {r["project_id"]: r["last_run_at"] for r in resp.data}


def scheduler_config():
    enabled = os.environ.get("SCHEDULER_ENABLED", "false").lower() == "true"
    return {
        "enabled": enabled,
        "dailyTimeUtc": os.environ.get("SCHEDULER_TIME_UTC", "09:00"),
        "status": "Enabled" if enabled else "Disabled (SCHEDULER_ENABLED=false)",
    }


def daily_flow_steps():
    return [
        {"step": 1, "title": "Run agent", "detail": "Fetch sprint, tag risks, generate nudges"},
        {"step": 2, "title": "Post health card", "detail": "Block-kit summary with score + status"},
        {"step": 3, "title": "Post standup digest", "detail": "Done · In Progress · Blocked · At Risk"},
        {"step": 4, "title": "Post owner nudges", "detail": "One Slack message per at-risk assignee"},
        {"step": 5, "title": "Pin accountability", "detail": "Team report pinned (bot token required)"},
        {"step": 6, "title": "Escalation alerts", "detail": "Fire if any member is HIGH_RISK for 2+ days"},
    ]


def project_channels():
    last_run = _last_run_by_project()
    webhook_configured = bool(os.environ.get("SLACK_WEBHOOK_URL", "").strip())
    channels = []
    for project in projects_store.all_projects():
        channels.append({
            "projectId": project["id"],
            "projectName": project["name"],
            "channel": project["channel"],
            "webhookConfigured": webhook_configured,
            "lastRun": last_run.get(project["id"]),
        })
    return channels


def mark_run(project_id):
    _client.table("slack_config").upsert(
        {"project_id": project_id, "last_run_at": datetime.now(timezone.utc).isoformat()}
    ).execute()


def escalations():
    rows = []
    for project in projects_store.all_projects():
        high_risk_count = sum(
            1 for member in projects_store.get_team()
            if team_insights.member_summary(member["email"], project_id=project["id"])["riskLevel"] == "HIGH"
        )
        rows.append({"projectId": project["id"], "projectName": project["name"], "highRiskCount": high_risk_count})
    return rows
