# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Agile Sprint Management Agent — a FastAPI + React app that ingests sprint data (live Jira or mock/seed), tags at-risk tickets, generates Claude-authored owner nudges and a standup digest, computes a sprint health score, and posts to Slack. Started as a 1-day hackathon PoC; has since grown multi-project support, CSV import, real HMAC-signed git webhooks, a daily scheduler, and demo login.

Two deeper docs exist and should be consulted, not duplicated here:
- **[SDLC.md](SDLC.md)** — the authoritative architecture reference: full route list, module catalogue, data model, extension playbooks ("how to add a risk rule / pipeline step / frontend page"), and an operations section (env vars, fallback matrix, testing). Read it before any non-trivial change.
- **[Agile Sprint Management Agent.md](Agile%20Sprint%20Management%20Agent.md)** — the original full product spec (personas, user flows, screen-by-screen UI, design system). Historical/product context, not a build reference.

SDLC.md's own accuracy note applies here too: if you add/remove a route, module, or persisted file, update SDLC.md in the same change.

## Commands

```bash
# Backend
cd backend
pip install -r requirements.txt        # or: ./.venv/bin/pip install -r requirements.txt if using the repo's venv
uvicorn main:app --reload --port 8000
pytest tests/                          # run all tests
pytest tests/test_risk_engine.py       # run one test file
pytest tests/test_risk_engine.py::test_stale_when_over_threshold_and_not_done -v   # run one test

# Run the agent pipeline from the CLI without the API server
python agent_runner.py --project checkout-revamp --step all
python agent_runner.py --project checkout-revamp --step risk   # step ∈ risk|nudge|summary|health|all

# Frontend
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run build      # production bundle
npm run preview    # serve the production build locally
```

There is no configured lint command for either side (no ESLint config in `frontend/`, no ruff/flake8 in `backend/`) and no frontend test runner — verify frontend changes by running the app (`npm run dev`) rather than an automated suite.

Both `backend/.env` and `frontend/.env` are gitignored; copy from `backend/.env.example` / `frontend/.env.example`. With `USE_MOCK_DATA=true` (default) and no `ANTHROPIC_API_KEY`, the app runs fully end-to-end using seed data and deterministic fallback text — no external credentials are required for local development.

## Architecture

**Layering** (see SDLC.md §3.2 for the full diagram): React pages talk to FastAPI routes (`backend/main.py`) via a single axios instance (`frontend/src/api/client.js`) — pages call `client.get('/api/...')` with literal URLs; there's no generated API wrapper layer. Routes orchestrate but hold no business logic themselves; that lives in **domain modules** (`risk_engine`, `health_score`, `team_insights`, `kanban`, `analytics`, `reports`), which must stay pure — no HTTP/Slack/Claude calls. **External modules** (`jira_client`, `nudge_generator`, `summary_generator`, `slack_sender`) each own a required fallback path for when their integration is offline or misconfigured. `projects_store.py` is the single in-memory source of truth for project/ticket state at runtime — every other module reads tickets through it, never `projects_data.json`/`user_projects.json` directly.

**The pipeline** (`agent_runner.run_pipeline`, called from `POST /api/run` and the Slack/scheduler path): fetch tickets → `risk_engine.tag_tickets` → `nudge_generator`/`summary_generator` (Claude, with deterministic fallback on failure) → `health_score.compute_health_score` + persist to `health_history.json`. A step failing doesn't crash the run — the result comes back `partial: true` with per-step error strings. Nudges and standup are **never dropped silently**: on Claude failure they fall back to text built directly from the ticket/sprint data rather than skipping the owner or returning nothing (`nudge_generator._fallback_nudge_message`, `summary_generator._fallback_standup`).

**Multi-project data isolation**: `health_history.json` entries carry a `projectId` field; `health_score.load_history(project_id)` filters by it and `save_health_entry` dedupes on `(date, projectId)`, not `date` alone — don't regress this back to a single shared, unfiltered history.

**Auth is UI-only**: `backend/auth.py` (demo credentials, in-memory bearer sessions) gates the frontend's login screen via `AuthGate` in `App.jsx`, but `require_auth` is not applied to any data route — every `/api/projects/...` endpoint is reachable unauthenticated regardless of login state. This is intentional for a showcase deployment; don't assume login implies API-level protection.

**Frontend data flow**: `ProjectProvider` holds the current project (persisted to `localStorage`); most pages fetch their own data directly in a `useEffect` keyed on `projectId` (no shared polling loop). `useSprint()` is the one shared hook (used by Dashboard/ReportsPage) and also re-fetches when `useAgentRun().runVersion` increments after a run completes. There is no polling on page data otherwise — only the agent-run status endpoint is polled (every 2s) while a run is in progress.

**Risk-tag thresholds** (`STALE_THRESHOLD_HOURS`, `STUCK_THRESHOLD_PCT`) are read from `.env` at runtime in `risk_engine.py` and must never be hardcoded elsewhere — including in generated explanatory text (`team_insights.py`'s `REASON_TEMPLATES` currently hardcodes the default values as prose; keep that in mind if you change the thresholds).

**Tailwind**: utility classes only, always as complete literal strings — `frontend/src/utils/riskColors.js` is the one place per-status/per-risk-tag classes live. Tailwind purges anything built via string concatenation, so never construct a class name dynamically.
