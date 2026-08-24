from unittest.mock import patch

import pytest
import requests

import jira_client


def _issue(**overrides):
    fields = {
        "summary": "Fix the thing",
        "status": {"name": "In Progress"},
        "assignee": {"displayName": "Alex Kim", "emailAddress": "alex@co.com"},
        "customfield_10016": 5,
        "priority": {"name": "P2"},
        "updated": "2026-08-01T00:00:00.000+0000",
        "created": "2026-07-28T09:00:00.000+0000",
        "issuelinks": [],
        "customfield_10100": "User can do the thing end to end.",
    }
    fields.update(overrides.pop("fields", {}))
    issue = {"key": "PROJ-1", "fields": fields}
    issue.update(overrides)
    return issue


def test_map_issue_maps_canonical_shape():
    ticket = jira_client._map_issue(_issue(), "customfield_10016", "customfield_10100")
    assert ticket["id"] == "PROJ-1"
    assert ticket["status"] == "In Progress"
    assert ticket["assignee"] == {"name": "Alex Kim", "email": "alex@co.com"}
    assert ticket["storyPoints"] == 5
    assert ticket["blockers"] == []


def test_map_issue_normalizes_status_name():
    ticket = jira_client._map_issue(_issue(fields={"status": {"name": "To Do"}}), "customfield_10016", "customfield_10100")
    assert ticket["status"] == "Todo"


def test_map_issue_handles_unassigned():
    ticket = jira_client._map_issue(_issue(fields={"assignee": None}), "customfield_10016", "customfield_10100")
    assert ticket["assignee"] == {"name": "", "email": ""}


def test_map_issue_extracts_blocking_link():
    issue = _issue(fields={
        "issuelinks": [
            {"type": {"name": "Blocks"}, "inwardIssue": {"key": "PROJ-2"}},
            {"type": {"name": "Relates"}, "outwardIssue": {"key": "PROJ-3"}},
        ]
    })
    ticket = jira_client._map_issue(issue, "customfield_10016", "customfield_10100")
    assert ticket["blockers"] == ["PROJ-2"]


def test_live_config_for_returns_none_when_mock_enabled(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "true")
    assert jira_client.live_config_for({"id": "p1"}) is None


def test_live_config_for_returns_none_when_incomplete(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "false")
    monkeypatch.delenv("JIRA_BASE_URL", raising=False)
    assert jira_client.live_config_for({"id": "p1"}) is None


def test_live_config_for_resolves_when_complete(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "false")
    monkeypatch.setenv("JIRA_BASE_URL", "https://x.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "me@co.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "tok")
    monkeypatch.setenv("JIRA_BOARD_ID", "1")
    monkeypatch.setenv("JIRA_SPRINT_ID", "2")
    config = jira_client.live_config_for({"id": "p1"})
    assert config == ("https://x.atlassian.net", "me@co.com", "tok", "1", "2")


def test_live_config_for_prefers_project_overrides(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "false")
    monkeypatch.setenv("JIRA_BASE_URL", "https://x.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "me@co.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "tok")
    monkeypatch.delenv("JIRA_BOARD_ID", raising=False)
    monkeypatch.delenv("JIRA_SPRINT_ID", raising=False)
    project = {"id": "p1", "jiraBoardId": "77", "jiraSprintId": "88"}
    config = jira_client.live_config_for(project)
    assert config == ("https://x.atlassian.net", "me@co.com", "tok", "77", "88")


def test_load_tickets_falls_back_to_mock_when_not_configured(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "true")
    project = {"id": "p1", "tickets": [{"id": "T-1"}]}
    tickets, source = jira_client.load_tickets(project)
    assert source == "mock"
    assert tickets == project["tickets"]


def test_load_tickets_falls_back_on_auth_failure(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "false")
    monkeypatch.setenv("JIRA_BASE_URL", "https://x.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "me@co.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "tok")
    monkeypatch.setenv("JIRA_BOARD_ID", "1")
    monkeypatch.setenv("JIRA_SPRINT_ID", "2")
    project = {"id": "p1", "tickets": [{"id": "T-1"}]}

    class FakeResponse:
        status_code = 401

        def json(self):
            return {}

    with patch("jira_client.requests.get", return_value=FakeResponse()):
        tickets, source = jira_client.load_tickets(project)
    assert source == "mock"
    assert tickets == project["tickets"]


def test_load_tickets_falls_back_on_network_error(monkeypatch):
    monkeypatch.setenv("USE_MOCK_DATA", "false")
    monkeypatch.setenv("JIRA_BASE_URL", "https://x.atlassian.net")
    monkeypatch.setenv("JIRA_EMAIL", "me@co.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "tok")
    monkeypatch.setenv("JIRA_BOARD_ID", "1")
    monkeypatch.setenv("JIRA_SPRINT_ID", "2")
    project = {"id": "p1", "tickets": [{"id": "T-1"}]}

    with patch("jira_client.requests.get", side_effect=requests.ConnectionError("boom")):
        tickets, source = jira_client.load_tickets(project)
    assert source == "mock"
    assert tickets == project["tickets"]
