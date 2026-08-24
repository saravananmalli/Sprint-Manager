"""Claude-authored standup digest (§10.1 FR-B5, §16.3)."""

import json
import logging
import os

import anthropic
from tenacity import retry, stop_after_attempt, wait_fixed

logger = logging.getLogger("sprint_agent")

MODEL = "claude-sonnet-4-6"

REQUIRED_HEADERS = [
    "*✅ Done yesterday*",
    "*🔄 In Progress today*",
    "*🚧 Blocked*",
    "*⚠️ At Risk*",
]

PROMPT_TEMPLATE = """You are a Scrum Master writing the daily async standup summary for the team.
Based on this sprint data, write a Slack standup digest.

Sprint data:
{sprint_json}

Format the output with exactly these four sections using these headers:
*✅ Done yesterday*
*🔄 In Progress today*
*🚧 Blocked*
*⚠️ At Risk*

Under each section, list items as bullet points with owner name in brackets.
Keep the entire summary under 300 words. Be factual, not motivational.
"""


def _client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
def _call_claude(prompt):
    client = _client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=600,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}],
        timeout=20,
    )
    return response.content[0].text


def _bullet_lines(tickets, empty_text, limit=6):
    if not tickets:
        return [f"• {empty_text}"]
    lines = []
    for t in tickets[:limit]:
        owner = t.get("assignee", {}).get("name") or "Unassigned"
        lines.append(f"• {t['id']} {t['summary']} [{owner}]")
    return lines


def _fallback_standup(sprint):
    """Deterministic stand-in for the Claude-authored digest, used when the
    API call fails (e.g. no ANTHROPIC_API_KEY configured) so a demo/offline
    run still produces a standup instead of nothing (§16.4)."""
    tickets = sprint.get("tickets", [])
    done = [t for t in tickets if t.get("status") == "Done"]
    blocked = [t for t in tickets if "BLOCKED" in t.get("riskTags", [])]
    at_risk = [t for t in tickets if t.get("riskTags") and t not in blocked]
    in_progress = [t for t in tickets if t.get("status") not in ("Done", "Todo", "Backlog") and t not in blocked]

    sections = [
        REQUIRED_HEADERS[0],
        *_bullet_lines(done, "Nothing closed since the last run."),
        "",
        REQUIRED_HEADERS[1],
        *_bullet_lines(in_progress, "Nothing actively in progress."),
        "",
        REQUIRED_HEADERS[2],
        *_bullet_lines(blocked, "No blockers reported."),
        "",
        REQUIRED_HEADERS[3],
        *_bullet_lines(at_risk, "Nothing currently at risk."),
    ]
    return "\n".join(sections)


def generate_standup(sprint):
    """Return the standup digest text. Falls back to a deterministic digest
    built from the sprint snapshot if Claude fails twice (§16.4)."""
    prompt = PROMPT_TEMPLATE.format(sprint_json=json.dumps(sprint, indent=2, default=str))
    try:
        text = _call_claude(prompt)
        if not text:
            raise ValueError("Claude returned an empty response")
    except Exception as exc:  # noqa: BLE001
        logger.warning({"event": "step_failed", "step": "standup_generation", "error": str(exc)})
        return _fallback_standup(sprint)
    return text.strip()
