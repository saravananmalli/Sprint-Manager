"""Parse an uploaded CSV of tickets into the canonical ticket shape used
throughout the app (see risk_engine / agent_runner). No LLM involved —
this is a deterministic column mapper, same spirit as risk_engine.

Expected header (case-insensitive, extra columns ignored):
  id, summary, status, assigneeName, assigneeEmail, storyPoints,
  lastUpdated, createdAt, blockers, acceptanceCriteria, priority

Only `id` and `summary` are required; everything else has a sane default
so a minimal spreadsheet (id, summary, status, assignee, points) still works.
"""

import csv
import io
from datetime import datetime, timezone

REQUIRED_COLUMNS = {"id", "summary"}

_COLUMN_ALIASES = {
    "key": "id",
    "ticket": "id",
    "ticketid": "id",
    "title": "summary",
    "assignee": "assigneename",
    "assigneeemail": "assigneeemail",
    "points": "storypoints",
    "storypoint": "storypoints",
}


def _normalize_header(fieldnames):
    normalized = []
    for name in fieldnames or []:
        key = (name or "").strip().lower().replace(" ", "").replace("_", "")
        normalized.append(_COLUMN_ALIASES.get(key, key))
    return normalized


def parse_csv(raw_bytes, now=None):
    """Return a list of canonical tickets parsed from CSV bytes.
    Raises ValueError with a human-readable message on bad input."""
    now = now or datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(f"CSV must be UTF-8 encoded: {exc}") from exc

    reader = csv.DictReader(io.StringIO(text))
    reader.fieldnames = _normalize_header(reader.fieldnames)

    if not REQUIRED_COLUMNS.issubset(set(reader.fieldnames or [])):
        raise ValueError("CSV must include at least 'id' and 'summary' columns")

    tickets = []
    seen_ids = set()
    for row_num, row in enumerate(reader, start=2):
        ticket_id = (row.get("id") or "").strip()
        summary = (row.get("summary") or "").strip()
        if not ticket_id or not summary:
            raise ValueError(f"Row {row_num}: 'id' and 'summary' are required")
        if ticket_id in seen_ids:
            raise ValueError(f"Row {row_num}: duplicate ticket id '{ticket_id}'")
        seen_ids.add(ticket_id)

        try:
            story_points = int(float(row.get("storypoints") or 0))
        except ValueError as exc:
            raise ValueError(f"Row {row_num}: storyPoints must be a number") from exc

        blockers_raw = (row.get("blockers") or "").strip()
        blockers = [b.strip() for b in blockers_raw.split(";") if b.strip()] if blockers_raw else []

        tickets.append({
            "id": ticket_id,
            "summary": summary,
            "status": (row.get("status") or "Backlog").strip() or "Backlog",
            "assignee": {
                "name": (row.get("assigneename") or "").strip(),
                "email": (row.get("assigneeemail") or "").strip(),
            },
            "storyPoints": story_points,
            "priority": (row.get("priority") or "P2").strip() or "P2",
            "priorityLabel": (row.get("prioritylabel") or "Med").strip() or "Med",
            "lastUpdated": (row.get("lastupdated") or "").strip() or now_iso,
            "createdAt": (row.get("createdat") or "").strip() or now_iso,
            "blockers": blockers,
            "acceptanceCriteria": (row.get("acceptancecriteria") or "").strip(),
        })

    if not tickets:
        raise ValueError("CSV contained no ticket rows")
    return tickets
