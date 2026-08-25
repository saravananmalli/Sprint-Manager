"""Live-editable runtime config, backed by Supabase's `runtime_settings` table.

Reading always reflects Supabase (with a short-lived cache for
get_thresholds() — see below). Writing updates the table and mirrors values
into os.environ immediately, since jira_client.py reads USE_MOCK_DATA
directly from the environment rather than through this module.
"""

import os
import time

from supabase import create_client

_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

EDITABLE_KEYS = {
    "USE_MOCK_DATA": {"type": "bool", "help": "Toggle to false to hit the live Jira REST API."},
    "STALE_THRESHOLD_HOURS": {"type": "int", "help": "Hours without update before STALE fires."},
    "STUCK_THRESHOLD_PCT": {"type": "int", "help": "% of sprint length before an In Progress ticket is STUCK."},
    "SPRINT_TOTAL_DAYS": {"type": "int", "help": "Sprint length in days, used for STUCK threshold math."},
}

_DEFAULTS = {
    "USE_MOCK_DATA": "true",
    "STALE_THRESHOLD_HOURS": "24",
    "STUCK_THRESHOLD_PCT": "50",
    "SPRINT_TOTAL_DAYS": "10",
}

# Safety net for a future multi-worker deployment, where one worker's
# update() can't invalidate another worker's cache — see get_thresholds().
_THRESHOLDS_CACHE_TTL_SECONDS = 5
_thresholds_cache = None
_thresholds_cache_at = 0.0


def _fetch_all():
    resp = _client.table("runtime_settings").select("*").execute()
    values = {r["key"]: r["value"] for r in resp.data}
    return {key: values.get(key, _DEFAULTS[key]) for key in EDITABLE_KEYS}


def get_all():
    values = _fetch_all()
    for key, value in values.items():
        os.environ[key] = value
    return {key: {"value": values[key], **meta} for key, meta in EDITABLE_KEYS.items()}


def update(values):
    unknown = set(values) - set(EDITABLE_KEYS)
    if unknown:
        raise ValueError(f"Unknown setting(s): {', '.join(sorted(unknown))}")

    rows = [{"key": key, "value": str(value)} for key, value in values.items()]
    _client.table("runtime_settings").upsert(rows).execute()

    for key, value in values.items():
        os.environ[key] = str(value)

    global _thresholds_cache
    _thresholds_cache = None

    return get_all()


def get_thresholds():
    """Cached read of the 3 risk-tag thresholds. Domain-module entry points
    (kanban/analytics/reports/team_insights/agent_runner) call this once per
    request and pass the result into risk_engine.tag_tickets, which is
    itself invoked in per-member/per-project loops — this cache is what
    keeps that from becoming a Supabase round-trip per ticket. Invalidated
    on update(); the TTL below is a safety net, not the primary mechanism."""
    global _thresholds_cache, _thresholds_cache_at
    now = time.monotonic()
    if _thresholds_cache is None or (now - _thresholds_cache_at) > _THRESHOLDS_CACHE_TTL_SECONDS:
        values = _fetch_all()
        _thresholds_cache = {
            "stale_hours": float(values["STALE_THRESHOLD_HOURS"]),
            "stuck_pct": float(values["STUCK_THRESHOLD_PCT"]),
            "sprint_total_days": float(values["SPRINT_TOTAL_DAYS"]),
        }
        _thresholds_cache_at = now
    return _thresholds_cache


# Mirror Supabase's current values into os.environ at import time, so
# jira_client.py's direct os.environ.get("USE_MOCK_DATA", ...) read sees the
# live value from the first request, not just after a Settings-page save.
get_all()
