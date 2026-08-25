"""FastAPI REST API — multi-project Sprint Agent backend."""

import hashlib
import hmac
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Literal, Optional

from dotenv import load_dotenv

# Must run before importing our own modules: projects_store/health_score/
# slack_config/runtime_settings read SUPABASE_URL etc. from os.environ at
# import time (module-level Supabase client construction), so .env has to be
# loaded first — unlike the JSON-file modules they replaced, which had no
# env-var dependency at import time.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ValidationError, field_validator

import agent_runner
import analytics
import auth
import health_score
import kanban
import projects_store
import reports
import risk_engine
import runtime_settings
import scheduler
import slack_config
import slack_sender
import sprint_importer
import team_insights

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("sprint_agent")


def validate_env():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.warning(json.dumps({"event": "env_warning", "detail": "ANTHROPIC_API_KEY not set — Claude calls will fail"}))
    if not os.environ.get("SLACK_WEBHOOK_URL"):
        logger.warning(json.dumps({"event": "env_warning", "detail": "SLACK_WEBHOOK_URL not set — Slack posting disabled"}))


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_env()
    if not os.environ.get("GIT_WEBHOOK_SECRET"):
        logger.warning(json.dumps({"event": "env_warning", "detail": "GIT_WEBHOOK_SECRET not set — /api/webhooks/git will accept unsigned requests"}))
    scheduler.start(_run_all_projects_and_post)
    yield
    scheduler.shutdown()


app = FastAPI(title="Sprint Agent API", lifespan=lifespan)

_cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGIN", "http://localhost:5173").split(",")
    if origin.strip()
]
for _origin in list(_cors_origins):
    if "://localhost:" in _origin:
        _alt = _origin.replace("://localhost:", "://127.0.0.1:")
    elif "://127.0.0.1:" in _origin:
        _alt = _origin.replace("://127.0.0.1:", "://localhost:")
    else:
        _alt = None
    if _alt and _alt not in _cors_origins:
        _cors_origins.append(_alt)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(auth.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"error": first.get("msg", "Validation error"), "detail": str(exc.errors()), "field": field})


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail if isinstance(exc.detail, str) else str(exc.detail)})


@app.exception_handler(KeyError)
async def key_error_handler(request, exc):
    return JSONResponse(status_code=404, content={"error": str(exc).strip("'\"")})


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": str(exc)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    logger.exception("Unhandled exception")
    detail = str(exc) if os.environ.get("LOG_LEVEL") == "DEBUG" else None
    return JSONResponse(status_code=500, content={"error": "Internal server error", "detail": detail})


# ---- in-memory run state (§14.3) ----

class RunState(BaseModel):
    run_id: str
    project_id: str
    status: Literal["running", "done", "error", "partial"]
    step: str
    progress: int
    error: Optional[str] = None
    errors: list[str] = []
    nudgeCount: int = 0
    startedAt: datetime
    finishedAt: Optional[datetime] = None


runs: dict[str, RunState] = {}
latest_results: dict[str, dict] = {}


def _project_summary(project_id, now=None, project=None, team=None, thresholds=None):
    """`project`/`team`/`thresholds` are optional pre-fetched inputs — pass
    them when summarizing multiple projects in one request (see
    list_projects) so each call doesn't re-hit Supabase for the same data."""
    project = project or projects_store.get_project(project_id)
    team = team if team is not None else projects_store.get_team()
    thresholds = thresholds or runtime_settings.get_thresholds()
    snapshot = agent_runner.build_sprint_snapshot(project, now=now)
    health = health_score.compute_health_score(snapshot["tickets"])
    at_risk = [t for t in snapshot["tickets"] if t["riskTags"]]
    at_risk_members = sum(
        1 for m in team
        if team_insights.member_risk_level([project], m["email"], thresholds) in ("MEDIUM", "HIGH")
    )
    return {
        "id": project["id"],
        "name": project["name"],
        "teamSlug": project["teamSlug"],
        "sprintName": project["sprintName"],
        "health": health["score"],
        "velocity": snapshot["velocity"],
        "pointsDone": snapshot["pointsDone"],
        "totalCommitted": snapshot["totalCommitted"],
        "sprintStatus": snapshot["sprintStatus"],
        "atRiskCount": len(at_risk),
        "atRiskMembers": at_risk_members,
        "ticketSource": snapshot["ticketSource"],
        "custom": not project.get("isSeed", False),
    }


# ---- projects ----

@app.get("/api/projects")
def list_projects():
    # Batch-fetch once and pass down — was previously N separate
    # get_project/get_team calls (one full re-fetch per project), each of
    # which also fanned out into a get_project-per-team-member loop.
    projects = projects_store.all_projects()
    team = projects_store.get_team()
    thresholds = runtime_settings.get_thresholds()
    summaries = [
        _project_summary(p["id"], project=p, team=team, thresholds=thresholds)
        for p in projects
    ]
    return {
        "projects": summaries,
        "totalProjects": len(summaries),
        "totalAtRisk": sum(p["atRiskCount"] for p in summaries),
        "totalAtRiskMembers": sum(p["atRiskMembers"] for p in summaries),
        "portfolioVelocity": round(sum(p["velocity"] for p in summaries) / len(summaries)) if summaries else 0,
        "totalPointsDone": sum(p["pointsDone"] for p in summaries),
        "totalPointsCommitted": sum(p["totalCommitted"] for p in summaries),
    }


class TicketInput(BaseModel):
    id: str
    summary: str
    status: str = "Backlog"
    assignee: dict = {"name": "", "email": ""}
    storyPoints: int = 0
    priority: str = "P2"
    priorityLabel: str = "Med"
    lastUpdated: Optional[str] = None
    createdAt: Optional[str] = None
    blockers: List[str] = []
    acceptanceCriteria: str = ""


class ProjectCreateRequest(BaseModel):
    name: str
    teamSlug: str
    sprintName: str
    startDate: str
    endDate: str
    prefix: str
    channel: Optional[str] = None
    tickets: List[TicketInput] = []

    @field_validator("name", "teamSlug", "sprintName", "prefix")
    @classmethod
    def not_blank(cls, v):
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_tickets_if_empty(tickets):
    now_iso = _now_iso()
    if tickets:
        dumped = [t.model_dump() for t in tickets]
        for t in dumped:
            t["lastUpdated"] = t["lastUpdated"] or now_iso
            t["createdAt"] = t["createdAt"] or now_iso
        return dumped
    return [{
        "id": "TICKET-1", "summary": "First ticket — edit or delete me", "status": "Backlog",
        "assignee": {"name": "", "email": ""}, "storyPoints": 1, "priority": "P2", "priorityLabel": "Med",
        "lastUpdated": now_iso, "createdAt": now_iso, "blockers": [], "acceptanceCriteria": "",
    }]


@app.post("/api/projects")
def post_create_project(body: ProjectCreateRequest):
    tickets = _default_tickets_if_empty(body.tickets)
    project = projects_store.create_project(
        name=body.name, team_slug=body.teamSlug, sprint_name=body.sprintName,
        start_date=body.startDate, end_date=body.endDate, prefix=body.prefix.upper(),
        tickets=tickets, channel=body.channel,
    )
    return _project_summary(project["id"], project=project)


@app.post("/api/projects/import")
async def post_import_project(
    name: str = Form(...),
    teamSlug: str = Form(...),
    sprintName: str = Form(...),
    startDate: str = Form(...),
    endDate: str = Form(...),
    prefix: str = Form(...),
    channel: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")
    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")
    try:
        tickets = sprint_importer.parse_csv(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project = projects_store.create_project(
        name=name.strip(), team_slug=teamSlug.strip(), sprint_name=sprintName.strip(),
        start_date=startDate, end_date=endDate, prefix=prefix.strip().upper(),
        tickets=tickets, channel=channel,
    )
    return _project_summary(project["id"], project=project)


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    projects_store.get_project(project_id)
    projects_store.delete_project(project_id)
    return {"deleted": project_id}


@app.get("/api/projects/{project_id}/sprint")
def get_project_sprint(project_id: str):
    project = projects_store.get_project(project_id)
    return agent_runner.build_sprint_snapshot(project)


@app.get("/api/projects/{project_id}/health")
def get_project_health(project_id: str):
    snapshot = get_project_sprint(project_id)
    health = health_score.compute_health_score(snapshot["tickets"])
    history = health_score.load_history(project_id)
    trend_input = history + ([{"score": health["score"]}] if health["score"] is not None else [])
    trend = health_score.compute_trend(trend_input)
    return {
        "score": health["score"],
        "trend": trend,
        "components": health["components"],
        "history": [
            {"date": h["date"], "score": h["score"], "sprintStatus": h.get("sprintStatus"), "ticketsAtRisk": h.get("ticketsAtRisk")}
            for h in history
        ],
    }


# ---- kanban ----

@app.get("/api/projects/{project_id}/kanban")
def get_kanban(project_id: str):
    projects_store.get_project(project_id)
    return kanban.build_board(project_id)


class KanbanSimulateRequest(BaseModel):
    event: Literal["git.push", "git.pr_opened", "git.pr_merged", "ci.passed"]
    ticketId: Optional[str] = None


@app.post("/api/projects/{project_id}/kanban/simulate")
def post_kanban_simulate(project_id: str, body: KanbanSimulateRequest):
    projects_store.get_project(project_id)
    return kanban.simulate_event(project_id, body.event, ticket_id=body.ticketId)


class KanbanMoveRequest(BaseModel):
    ticketId: str
    toColumn: Literal["Backlog", "In Progress", "Testing", "In Review", "Done"]


@app.post("/api/projects/{project_id}/kanban/move")
def post_kanban_move(project_id: str, body: KanbanMoveRequest):
    projects_store.get_project(project_id)
    return kanban.move_ticket(project_id, body.ticketId, body.toColumn)


@app.post("/api/projects/{project_id}/kanban/reset")
def post_kanban_reset(project_id: str):
    projects_store.reset_project(project_id)
    return kanban.build_board(project_id)


# ---- webhooks ----

class GitWebhookPayload(BaseModel):
    project: str
    event: Literal["git.push", "git.pr_opened", "git.pr_merged", "ci.passed"]
    ticketIds: List[str]
    actor: str = "webhook"

    @field_validator("ticketIds")
    @classmethod
    def non_empty(cls, v):
        if not v:
            raise ValueError("ticketIds must contain at least one ticket id")
        if len(v) > 50:
            raise ValueError("ticketIds must contain at most 50 ids")
        return v


@app.post("/api/webhooks/git")
async def post_webhook_git(request: Request):
    raw_body = await request.body()
    secret = os.environ.get("GIT_WEBHOOK_SECRET")
    if secret:
        signature = request.headers.get("X-Webhook-Signature", "")
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid or missing X-Webhook-Signature")

    try:
        payload = GitWebhookPayload.model_validate_json(raw_body)
    except ValidationError as exc:
        raise RequestValidationError(errors=exc.errors()) from exc

    projects_store.get_project(payload.project)
    return kanban.apply_webhook_event(payload.project, payload.event, payload.ticketIds, actor=payload.actor)


# ---- team ----

@app.get("/api/team")
def get_team(project: Optional[str] = Query(None)):
    if project:
        projects_store.get_project(project)
    return {"members": team_insights.list_team(project_id=project, latest_results=latest_results)}


@app.get("/api/team/{email}")
def get_team_member(email: str, project: Optional[str] = Query(None)):
    if project:
        projects_store.get_project(project)
    member = next((m for m in projects_store.get_team() if m["email"] == email), None)
    if not member:
        raise HTTPException(status_code=404, detail=f"Unknown team member '{email}'")
    summary = team_insights.member_summary(email, project_id=project, latest_results=latest_results)
    projects = [p["name"] for p in projects_store.all_projects() if any(
        t.get("assignee", {}).get("email") == email for t in p["tickets"]
    )]
    return {**member, "projects": projects, **summary}


# ---- reports ----

@app.get("/api/projects/{project_id}/reports/leadership")
def get_leadership_report(project_id: str):
    projects_store.get_project(project_id)
    return reports.build_report(project_id)


@app.get("/api/projects/{project_id}/reports/pdf")
def get_report_pdf(project_id: str):
    projects_store.get_project(project_id)
    pdf_bytes = reports.build_pdf(project_id)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{project_id}-sprint-report.pdf"'
    })


@app.post("/api/projects/{project_id}/reports/email")
def post_report_email(project_id: str):
    projects_store.get_project(project_id)
    return reports.send_email(project_id)


@app.get("/api/projects/{project_id}/reports/standup")
def get_project_standup(project_id: str):
    result = latest_results.get(project_id)
    if not result or not result.get("standup"):
        raise HTTPException(status_code=404, detail="No standup available. Trigger a run first.")
    return {"generatedAt": result["generatedAt"], "text": result["standup"]}


# ---- analytics ----

@app.get("/api/projects/{project_id}/analytics")
def get_analytics(project_id: str):
    projects_store.get_project(project_id)
    return analytics.build_analytics(project_id)


# ---- run pipeline ----

def _execute_run(run_id: str, project_id: str):
    state = runs[run_id]

    def on_progress(step_name, pct):
        state.step = step_name
        state.progress = pct

    try:
        result = agent_runner.run_pipeline(project_id, steps=["all"], on_progress=on_progress)
        result["generatedAt"] = datetime.now(timezone.utc).isoformat()
        latest_results[project_id] = result
        state.status = "partial" if result["partial"] else "done"
        state.errors = result.get("errors", [])
        state.nudgeCount = len(result.get("nudges", []))
    except Exception as exc:  # noqa: BLE001
        logger.exception(json.dumps({"event": "run_failed", "run_id": run_id}))
        state.status = "error"
        state.error = str(exc)
    finally:
        state.finishedAt = datetime.now(timezone.utc)


@app.post("/api/run", status_code=202)
def post_run(background_tasks: BackgroundTasks, project: str = Query(...)):
    projects_store.get_project(project)
    if any(s.status == "running" for s in runs.values()):
        raise HTTPException(status_code=409, detail="A run is already in progress")

    run_id = str(uuid.uuid4())
    runs[run_id] = RunState(
        run_id=run_id, project_id=project, status="running", step="Starting", progress=0,
        startedAt=datetime.now(timezone.utc),
    )
    logger.info(json.dumps({"event": "run_started", "run_id": run_id, "project": project}))
    background_tasks.add_task(_execute_run, run_id, project)
    return {"run_id": run_id, "status": "running"}


@app.get("/api/run/status")
def get_run_status(run_id: uuid.UUID = Query(...)):
    state = runs.get(str(run_id))
    if not state:
        raise HTTPException(status_code=404, detail="Unknown run_id")
    return state


class NudgesSendRequest(BaseModel):
    type: Literal["standup", "nudges", "all"]
    messages: Optional[List[str]] = None

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if v is not None:
            if len(v) > 20:
                raise ValueError("messages must contain at most 20 items")
            for m in v:
                if len(m) > 4000:
                    raise ValueError("each message must be at most 4000 characters")
        return v


@app.get("/api/projects/{project_id}/nudges")
def get_nudges(project_id: str):
    result = latest_results.get(project_id)
    if not result:
        return {"generatedAt": None, "nudges": []}
    return {"generatedAt": result["generatedAt"], "nudges": result.get("nudges", [])}


@app.post("/api/projects/{project_id}/nudges/send")
def post_nudges_send(project_id: str, body: NudgesSendRequest):
    projects_store.get_project(project_id)
    result = latest_results.get(project_id)
    if not result:
        return {"posted": 0, "skipped": 0, "slackEnabled": slack_sender.slack_enabled()}
    return agent_runner.post_to_slack(result, project_id, post_type=body.type)


# ---- slack ----

def _run_and_post(project_id):
    """Run the full pipeline for one project, cache the result, post to
    Slack, and record the run time. Shared by the manual 'send to Slack'
    button, the scheduler, and (indirectly) /api/run."""
    result = agent_runner.run_pipeline(project_id, steps=["all"])
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    latest_results[project_id] = result
    outcome = agent_runner.post_to_slack(result, project_id, post_type="all")
    slack_config.mark_run(project_id)
    return outcome


def _run_all_projects_and_post():
    for project_id in projects_store.list_project_ids():
        _run_and_post(project_id)


@app.get("/api/slack/overview")
def get_slack_overview():
    return {
        "scheduler": {**slack_config.scheduler_config(), "running": scheduler.is_running()},
        "dailyFlow": slack_config.daily_flow_steps(),
        "escalations": slack_config.escalations(),
        "channels": slack_config.project_channels(),
    }


@app.post("/api/slack/send/{project_id}")
def post_slack_send(project_id: str):
    projects_store.get_project(project_id)
    return _run_and_post(project_id)


# ---- settings ----

@app.get("/api/settings/runtime")
def get_runtime_settings():
    return runtime_settings.get_all()


class RuntimeSettingsUpdate(BaseModel):
    values: dict


@app.put("/api/settings/runtime")
def put_runtime_settings(body: RuntimeSettingsUpdate):
    return runtime_settings.update(body.values)
