"""Thin APScheduler wrapper. Fires `run_callback` once daily at
SCHEDULER_TIME_UTC when SCHEDULER_ENABLED=true; otherwise a no-op.

Kept generic on purpose — main.py owns what a "run" actually does (pipeline
+ Slack post), this module only owns the cron trigger.
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("sprint_agent")

_scheduler = None


def start(run_callback):
    global _scheduler
    if os.environ.get("SCHEDULER_ENABLED", "false").lower() != "true":
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return None

    time_str = os.environ.get("SCHEDULER_TIME_UTC", "09:00")
    try:
        hour, minute = (int(p) for p in time_str.split(":"))
    except ValueError:
        logger.error("Invalid SCHEDULER_TIME_UTC=%r — expected HH:MM, scheduler not started", time_str)
        return None

    def _job():
        try:
            run_callback()
        except Exception:  # noqa: BLE001
            logger.exception("Scheduled run failed")

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_job, CronTrigger(hour=hour, minute=minute), id="daily_run", replace_existing=True)
    _scheduler.start()
    logger.info("Scheduler started — daily run at %02d:%02d UTC", hour, minute)
    return _scheduler


def shutdown():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def is_running():
    return _scheduler is not None and _scheduler.running
