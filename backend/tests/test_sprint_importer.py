import pytest

import sprint_importer


def _csv(text):
    return text.encode("utf-8")


def test_parses_minimal_csv():
    raw = _csv("id,summary\nPROJ-1,Fix the thing\nPROJ-2,Ship the other thing\n")
    tickets = sprint_importer.parse_csv(raw)
    assert len(tickets) == 2
    assert tickets[0]["id"] == "PROJ-1"
    assert tickets[0]["status"] == "Backlog"
    assert tickets[0]["storyPoints"] == 0
    assert tickets[0]["assignee"] == {"name": "", "email": ""}


def test_parses_full_columns_and_aliases():
    raw = _csv(
        "Key,Title,status,assignee,assigneeEmail,points,blockers,acceptanceCriteria,priority\n"
        "PROJ-1,Fix the thing,In Progress,Alex Kim,alex@co.com,5,PROJ-9;PROJ-8,User can do X,P1\n"
    )
    tickets = sprint_importer.parse_csv(raw)
    t = tickets[0]
    assert t["id"] == "PROJ-1"
    assert t["summary"] == "Fix the thing"
    assert t["status"] == "In Progress"
    assert t["assignee"] == {"name": "Alex Kim", "email": "alex@co.com"}
    assert t["storyPoints"] == 5
    assert t["blockers"] == ["PROJ-9", "PROJ-8"]
    assert t["acceptanceCriteria"] == "User can do X"
    assert t["priority"] == "P1"


def test_missing_required_columns_raises():
    raw = _csv("foo,bar\n1,2\n")
    with pytest.raises(ValueError, match="id.*summary"):
        sprint_importer.parse_csv(raw)


def test_missing_id_in_row_raises():
    raw = _csv("id,summary\n,Fix the thing\n")
    with pytest.raises(ValueError, match="Row 2"):
        sprint_importer.parse_csv(raw)


def test_duplicate_id_raises():
    raw = _csv("id,summary\nPROJ-1,First\nPROJ-1,Second\n")
    with pytest.raises(ValueError, match="duplicate"):
        sprint_importer.parse_csv(raw)


def test_empty_csv_raises():
    raw = _csv("id,summary\n")
    with pytest.raises(ValueError, match="no ticket rows"):
        sprint_importer.parse_csv(raw)


def test_invalid_story_points_raises():
    raw = _csv("id,summary,storyPoints\nPROJ-1,Fix,abc\n")
    with pytest.raises(ValueError, match="storyPoints must be a number"):
        sprint_importer.parse_csv(raw)
