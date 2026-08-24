import summary_generator


class _FakeContentBlock:
    def __init__(self, text):
        self.text = text


class _FakeResponse:
    def __init__(self, text):
        self.content = [_FakeContentBlock(text)]


class _FakeMessages:
    def __init__(self, text, capture):
        self._text = text
        self._capture = capture

    def create(self, **kwargs):
        self._capture.append(kwargs)
        return _FakeResponse(self._text)


class _FakeClient:
    def __init__(self, text, capture):
        self.messages = _FakeMessages(text, capture)


SAMPLE_DIGEST = (
    "*✅ Done yesterday*\n• PROJ-101 (Alex)\n\n"
    "*\U0001f504 In Progress today*\n• PROJ-104 (Alex)\n\n"
    "*\U0001f6a7 Blocked*\n• PROJ-108 (Karthik)\n\n"
    "*⚠️ At Risk*\n• PROJ-106 (Meera)"
)

SAMPLE_SPRINT = {
    "sprintName": "Sprint 14",
    "startDate": "2026-07-28",
    "endDate": "2026-08-08",
    "tickets": [],
}


def test_generate_standup_returns_text_and_uses_sonnet_model(monkeypatch):
    captured = []
    monkeypatch.setattr(summary_generator, "_client", lambda: _FakeClient(SAMPLE_DIGEST, captured))

    result = summary_generator.generate_standup(SAMPLE_SPRINT)

    assert result == SAMPLE_DIGEST
    assert len(captured) == 1
    call = captured[0]
    assert call["model"] == "claude-sonnet-4-6"
    assert call["max_tokens"] == 600
    assert call["temperature"] == 0.3
    prompt = call["messages"][0]["content"]
    assert "Sprint 14" in prompt
    for header in summary_generator.REQUIRED_HEADERS:
        assert header in prompt


def test_generated_digest_contains_all_four_section_headers():
    for header in summary_generator.REQUIRED_HEADERS:
        assert header in SAMPLE_DIGEST


def test_generate_standup_falls_back_to_deterministic_digest_on_repeated_failure(monkeypatch):
    class _FailingMessages:
        def create(self, **kwargs):
            raise RuntimeError("Claude API unavailable")

    class _FailingClient:
        def __init__(self):
            self.messages = _FailingMessages()

    monkeypatch.setattr(summary_generator, "_client", lambda: _FailingClient())
    monkeypatch.setattr(summary_generator, "_call_claude", lambda prompt: (_ for _ in ()).throw(RuntimeError("fail")))

    result = summary_generator.generate_standup(SAMPLE_SPRINT)
    assert result is not None
    for header in summary_generator.REQUIRED_HEADERS:
        assert header in result


def test_fallback_standup_buckets_tickets_by_status_and_risk():
    sprint = {
        "tickets": [
            {"id": "A-1", "summary": "Done ticket", "status": "Done", "assignee": {"name": "Alex"}, "riskTags": []},
            {"id": "A-2", "summary": "WIP ticket", "status": "In Progress", "assignee": {"name": "Sam"}, "riskTags": []},
            {"id": "A-3", "summary": "Blocked ticket", "status": "In Progress", "assignee": {"name": "Kai"}, "riskTags": ["BLOCKED"]},
            {"id": "A-4", "summary": "Stale ticket", "status": "In Progress", "assignee": {"name": "Lee"}, "riskTags": ["STALE"]},
        ]
    }
    digest = summary_generator._fallback_standup(sprint)
    assert "A-1" in digest.split(summary_generator.REQUIRED_HEADERS[1])[0]
    assert "A-2" in digest
    assert "A-3" in digest.split(summary_generator.REQUIRED_HEADERS[3])[0]
    assert "A-4" in digest.split(summary_generator.REQUIRED_HEADERS[3])[1]
