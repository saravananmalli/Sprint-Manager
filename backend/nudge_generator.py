"""Claude-authored owner nudges (§10.1 FR-B4, §16.2, §11.6)."""

import logging
import os
from collections import defaultdict
from datetime import datetime, timezone

import anthropic
from tenacity import retry, stop_after_attempt, wait_fixed

logger = logging.getLogger("sprint_agent")

MODEL = "claude-sonnet-4-6"

PROMPT_TEMPLATE = """You are a friendly, supportive Scrum Master writing a Slack message.
Draft a nudge for {assignee_name} about the following stale ticket(s):

{ticket_list}

Rules:
- Max 3 sentences total
- Reference each ticket by ID and name
- Mention days since last update and sprint days remaining ({days_remaining} days left)
- Tone: collegial, not passive-aggressive
- No bullet points — write as natural Slack message
- Do not start with "Hey" or "Hi"
"""


def _client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
def _call_claude(prompt):
    client = _client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=300,
        temperature=0.5,
        messages=[{"role": "user", "content": prompt}],
        timeout=20,
    )
    return response.content[0].text


def _at_risk_owners(tickets):
    """Group at-risk tickets by assignee — one nudge per owner (§11.6)."""
    owners = defaultdict(list)
    for ticket in tickets:
        if ticket.get("riskTags") and ticket.get("assignee", {}).get("name"):
            owners[ticket["assignee"]["name"]].append(ticket)
    return owners


def _fallback_nudge_message(name, owner_tickets, days_remaining, now):
    """Deterministic stand-in for the Claude-authored nudge, used when the
    API call fails (e.g. no ANTHROPIC_API_KEY configured) so a demo/offline
    run still has something to show instead of silently dropping the owner."""
    refs = []
    for t in owner_tickets:
        last_updated = datetime.fromisoformat(t["lastUpdated"].replace("Z", "+00:00"))
        hours_since = round((now - last_updated).total_seconds() / 3600)
        refs.append(f"{t['id']} ({t['summary']}, {hours_since}h since last update)")
    ticket_text = "; ".join(refs)
    these = "these" if len(owner_tickets) > 1 else "this"
    days_text = f"{days_remaining} day{'s' if days_remaining != 1 else ''}"
    return (
        f"Wanted to flag {ticket_text} — with {days_text} left in the sprint, "
        f"it'd help to get {these} moving again. Let me know if you're blocked on anything."
    )


def generate_nudges(sprint):
    """Return a list of {assignee, ticketIds, message} — one per at-risk
    owner. A Claude failure for an owner falls back to a deterministic
    message rather than dropping the owner (§16.4)."""
    tickets = sprint["tickets"]
    days_remaining = sprint.get("daysRemaining", 0)
    owners = _at_risk_owners(tickets)
    now = datetime.now(timezone.utc)

    nudges = []
    for name, owner_tickets in owners.items():
        ticket_lines = []
        for t in owner_tickets:
            last_updated = datetime.fromisoformat(t["lastUpdated"].replace("Z", "+00:00"))
            hours_since = round((now - last_updated).total_seconds() / 3600)
            ticket_lines.append(f"- {t['id']} ({t['summary']}): last updated {hours_since}h ago, risks: {', '.join(t['riskTags'])}")

        prompt = PROMPT_TEMPLATE.format(
            assignee_name=name,
            ticket_list="\n".join(ticket_lines),
            days_remaining=days_remaining,
        )

        try:
            message = _call_claude(prompt)
            if message is None:
                raise ValueError("Claude returned an empty response")
        except Exception as exc:  # noqa: BLE001 - degrade gracefully per §16.4
            logger.warning({"event": "step_failed", "step": "nudge_generation", "assignee": name, "error": str(exc)})
            message = _fallback_nudge_message(name, owner_tickets, days_remaining, now)

        nudges.append({
            "assignee": owner_tickets[0]["assignee"],
            "ticketIds": [t["id"] for t in owner_tickets],
            "message": message.strip(),
        })

    return nudges
