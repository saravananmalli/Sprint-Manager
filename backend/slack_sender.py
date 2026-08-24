"""Slack Incoming Webhook posting (§10.1 FR-B7, §17)."""

import logging
import os

import requests
from tenacity import retry, retry_if_result, stop_after_attempt, wait_fixed

logger = logging.getLogger("sprint_agent")


def _webhook_url():
    return os.environ.get("SLACK_WEBHOOK_URL", "").strip()


def slack_enabled():
    return bool(_webhook_url())


@retry(
    retry=retry_if_result(lambda resp: resp is not None and resp.status_code == 429),
    stop=stop_after_attempt(3),
    wait=wait_fixed(1),
)
def _post(payload):
    return requests.post(_webhook_url(), json=payload, timeout=20)


def _send(payload):
    if not slack_enabled():
        logger.info({"event": "slack_disabled"})
        return False
    try:
        response = _post(payload)
    except Exception as exc:  # noqa: BLE001 - log and continue, no retry beyond 429 backoff
        logger.warning({"event": "slack_post_failed", "error": str(exc)})
        return False
    if response.status_code != 200:
        logger.warning({"event": "slack_post_failed", "status": response.status_code, "body": response.text})
        return False
    return True


def send_health_score(sprint_name, score, trend, sprint_status):
    payload = {
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{sprint_name} — Health Score"}},
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Score:* {score if score is not None else '—'} / 100 ({trend})"},
                    {"type": "mrkdwn", "text": f"*Status:* {sprint_status}"},
                ],
            },
        ]
    }
    return _send(payload)


def send_standup(text):
    return _send({"text": text})


def send_nudge(text):
    return _send({"text": text})
