from datetime import date, timedelta

import health_score
import projects_store


def _make_project(name, prefix):
    """health_history.project_id is a real FK to projects(id), so these
    tests need an actual (temporary) project row to write entries against."""
    return projects_store.create_project(
        name=name, team_slug=prefix.lower(), sprint_name="S1",
        start_date="2026-01-01", end_date="2026-01-10", prefix=prefix,
        tickets=[{"id": f"{prefix}-1", "summary": "x", "status": "Todo", "storyPoints": 1}],
    )


def test_compute_velocity_midpoint():
    sprint = {"startDate": "2026-08-01", "endDate": "2026-08-11", "totalCommitted": 20, "pointsDone": 10}
    result = health_score.compute_velocity(sprint, today=date(2026, 8, 6))
    assert result["daysElapsed"] == 5
    assert result["daysRemaining"] == 5
    assert result["velocity"] == 50.0
    assert result["projectedCompletion"] == 20.0
    assert result["sprintStatus"] == "On Track"


def test_compute_velocity_off_track():
    sprint = {"startDate": "2026-08-01", "endDate": "2026-08-11", "totalCommitted": 20, "pointsDone": 2}
    result = health_score.compute_velocity(sprint, today=date(2026, 8, 6))
    # dailyBurnRate = 2/5 = 0.4, projected = 0.4*5 + 2 = 4.0 -> 4/20 = 20% < 70%
    assert result["projectedCompletion"] == 4.0
    assert result["sprintStatus"] == "Off Track"


def test_compute_health_score_golden_case():
    tickets = [
        {"status": "Done", "storyPoints": 3, "riskTags": []},
        {"status": "Done", "storyPoints": 2, "riskTags": []},
        {"status": "In Progress", "storyPoints": 5, "riskTags": ["BLOCKED"]},
        {"status": "In Progress", "storyPoints": 3, "riskTags": ["STALE"]},
    ]
    result = health_score.compute_health_score(tickets)
    assert result["score"] == 58
    assert result["components"] == {
        "velocityScore": 38,
        "blockerScore": 75,
        "stalenessScore": 75,
        "completionScore": 50,
    }


def test_compute_health_score_empty_tickets_returns_none():
    result = health_score.compute_health_score([])
    assert result["score"] is None
    assert result["components"] is None


def test_compute_trend_improving():
    history = [{"date": "2026-08-01", "score": 50}, {"date": "2026-08-02", "score": 60}]
    assert health_score.compute_trend(history) == "Improving"


def test_compute_trend_declining():
    history = [{"date": "2026-08-01", "score": 70}, {"date": "2026-08-02", "score": 60}]
    assert health_score.compute_trend(history) == "Declining"


def test_compute_trend_stable_within_band():
    history = [{"date": "2026-08-01", "score": 65}, {"date": "2026-08-02", "score": 68}]
    assert health_score.compute_trend(history) == "Stable"


def test_compute_trend_stable_with_fewer_than_two_entries():
    assert health_score.compute_trend([]) == "Stable"
    assert health_score.compute_trend([{"date": "2026-08-01", "score": 50}]) == "Stable"


def test_save_health_entry_overwrites_same_date_and_prunes():
    # Per-project cap (Supabase migration fix — the legacy JSON file capped
    # at MAX_HISTORY_ENTRIES *globally* across all projects combined, a
    # confirmed bug; each project now keeps its own 30-entry history).
    project = _make_project("HS Prune Test", "HSP")
    project_id = project["id"]
    dates = [(date(2026, 1, 1) + timedelta(days=i)).isoformat() for i in range(32)]
    try:
        for i, d in enumerate(dates):
            health_score.save_health_entry({"date": d, "projectId": project_id, "score": i + 1})

        # 32 distinct dates written; oldest 2 should be pruned to MAX_HISTORY_ENTRIES
        history = health_score.load_history(project_id)
        assert len(history) == health_score.MAX_HISTORY_ENTRIES
        assert history[0]["date"] == dates[2]
        assert history[-1]["date"] == dates[-1]
        assert history == sorted(history, key=lambda h: h["date"])

        health_score.save_health_entry({"date": dates[-1], "projectId": project_id, "score": 999})
        history = health_score.load_history(project_id)
        assert len(history) == health_score.MAX_HISTORY_ENTRIES
        assert history[-1]["score"] == 999
    finally:
        projects_store.delete_project(project_id)


def test_save_health_entry_isolates_by_project():
    project_a = _make_project("HS Iso A", "HSA")
    project_b = _make_project("HS Iso B", "HSB")
    try:
        health_score.save_health_entry({"date": "2026-02-01", "projectId": project_a["id"], "score": 40})
        health_score.save_health_entry({"date": "2026-02-01", "projectId": project_b["id"], "score": 90})

        proj_a_history = health_score.load_history(project_a["id"])
        assert len(proj_a_history) == 1
        assert proj_a_history[0]["score"] == 40

        proj_b_history = health_score.load_history(project_b["id"])
        assert len(proj_b_history) == 1
        assert proj_b_history[0]["score"] == 90

        # Overwriting proj_a's same-date entry must not touch proj_b's.
        health_score.save_health_entry({"date": "2026-02-01", "projectId": project_a["id"], "score": 45})
        assert health_score.load_history(project_a["id"])[0]["score"] == 45
        assert health_score.load_history(project_b["id"])[0]["score"] == 90
    finally:
        projects_store.delete_project(project_a["id"])
        projects_store.delete_project(project_b["id"])
