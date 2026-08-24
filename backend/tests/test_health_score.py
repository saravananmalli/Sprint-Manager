from datetime import date

import health_score


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


def test_save_health_entry_overwrites_same_date_and_prunes(tmp_path, monkeypatch):
    history_file = tmp_path / "health_history.json"
    monkeypatch.setattr(health_score, "HISTORY_PATH", str(history_file))
    monkeypatch.setattr(health_score, "LOCK_PATH", str(history_file) + ".lock")

    for day in range(1, 33):
        health_score.save_health_entry({"date": f"2026-01-{day:02d}", "score": day})

    # 32 distinct dates written; oldest 2 should be pruned to MAX_HISTORY_ENTRIES
    history = health_score.load_history()
    assert len(history) == health_score.MAX_HISTORY_ENTRIES
    assert history[0]["date"] == "2026-01-03"
    assert history[-1]["date"] == "2026-01-32"
    assert history == sorted(history, key=lambda h: h["date"])

    health_score.save_health_entry({"date": "2026-01-32", "score": 999})
    history = health_score.load_history()
    assert len(history) == health_score.MAX_HISTORY_ENTRIES
    assert history[-1]["score"] == 999


def test_save_health_entry_isolates_by_project(tmp_path, monkeypatch):
    history_file = tmp_path / "health_history.json"
    monkeypatch.setattr(health_score, "HISTORY_PATH", str(history_file))
    monkeypatch.setattr(health_score, "LOCK_PATH", str(history_file) + ".lock")

    health_score.save_health_entry({"date": "2026-02-01", "projectId": "proj-a", "score": 40})
    health_score.save_health_entry({"date": "2026-02-01", "projectId": "proj-b", "score": 90})

    all_history = health_score.load_history()
    assert len(all_history) == 2

    proj_a_history = health_score.load_history("proj-a")
    assert len(proj_a_history) == 1
    assert proj_a_history[0]["score"] == 40

    proj_b_history = health_score.load_history("proj-b")
    assert len(proj_b_history) == 1
    assert proj_b_history[0]["score"] == 90

    # Overwriting proj-a's same-date entry must not touch proj-b's.
    health_score.save_health_entry({"date": "2026-02-01", "projectId": "proj-a", "score": 45})
    assert health_score.load_history("proj-a")[0]["score"] == 45
    assert health_score.load_history("proj-b")[0]["score"] == 90
