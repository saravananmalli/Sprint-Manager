from datetime import datetime, timedelta, timezone

import risk_engine

NOW = datetime(2026, 8, 4, 9, 15, tzinfo=timezone.utc)
THRESHOLDS = {"stale_hours": 24, "stuck_pct": 50, "sprint_total_days": 10}


def _ticket(**overrides):
    base = {
        "status": "In Progress",
        "lastUpdated": (NOW - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "createdAt": (NOW - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "assignee": {"name": "Alex", "email": "alex@co.com"},
        "blockers": [],
        "acceptanceCriteria": "A" * 30,
    }
    base.update(overrides)
    return base


def test_stale_when_over_threshold_and_not_done():
    t = _ticket(lastUpdated=(NOW - timedelta(hours=25)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "STALE" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_not_stale_at_exact_threshold_boundary():
    t = _ticket(lastUpdated=(NOW - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "STALE" not in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_not_stale_when_done():
    t = _ticket(status="Done", lastUpdated=(NOW - timedelta(hours=100)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "STALE" not in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_stuck_when_in_progress_beyond_threshold_days():
    t = _ticket(status="In Progress", createdAt=(NOW - timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "STUCK" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_not_stuck_when_status_is_not_in_progress():
    t = _ticket(status="Todo", createdAt=(NOW - timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "STUCK" not in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_unassigned_when_no_assignee():
    t = _ticket(assignee=None)
    assert "UNASSIGNED" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_unassigned_when_empty_name():
    t = _ticket(assignee={"name": "", "email": ""})
    assert "UNASSIGNED" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_blocked_when_blockers_present():
    t = _ticket(blockers=["PROJ-1"])
    assert "BLOCKED" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_not_blocked_when_blockers_empty():
    t = _ticket(blockers=[])
    assert "BLOCKED" not in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_incomplete_ac_when_none():
    t = _ticket(acceptanceCriteria=None)
    assert "INCOMPLETE_AC" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_incomplete_ac_when_too_short():
    t = _ticket(acceptanceCriteria="short")
    assert "INCOMPLETE_AC" in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_ac_complete_at_boundary_length():
    t = _ticket(acceptanceCriteria="A" * 20)
    assert "INCOMPLETE_AC" not in risk_engine.tag_ticket(t, now=NOW, thresholds=THRESHOLDS)


def test_tag_tickets_preserves_order_and_count():
    tickets = [_ticket(), _ticket(status="Done", lastUpdated=NOW.strftime("%Y-%m-%dT%H:%M:%SZ"))]
    tagged = risk_engine.tag_tickets(tickets, now=NOW)
    assert len(tagged) == 2
    assert all("riskTags" in t for t in tagged)
