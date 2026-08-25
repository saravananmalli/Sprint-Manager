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

Both `backend/.env` and `frontend/.env` are gitignored; copy from `backend/.env.example` / `frontend/.env.example`. With `USE_MOCK_DATA=true` (default) and no `ANTHROPIC_API_KEY`, the app runs end-to-end using seed data and deterministic fallback text with no *external* credentials — but it does always require Supabase (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`), hosted or via the Supabase CLI's local stack (`supabase start`, Docker-based, no account needed), since that's where project/ticket/settings state now lives. See `backend/migrations/` for schema + one-time seed script.

## Architecture

**Layering** (see SDLC.md §3.2 for the full diagram): React pages talk to FastAPI routes (`backend/main.py`) via a single axios instance (`frontend/src/api/client.js`) — pages call `client.get('/api/...')` with literal URLs; there's no generated API wrapper layer. Routes orchestrate but hold no business logic themselves; that lives in **domain modules** (`risk_engine`, `health_score`, `team_insights`, `kanban`, `analytics`, `reports`), which must stay pure — no HTTP/Slack/Claude/DB calls (the one scoped exception: `kanban`/`analytics`/`reports`/`team_insights` each call `runtime_settings.get_thresholds()` once per entry point to fetch live risk-tag thresholds — see below). **External modules** (`jira_client`, `nudge_generator`, `summary_generator`, `slack_sender`) each own a required fallback path for when their integration is offline or misconfigured. `projects_store.py` is the source of truth for project/ticket state, backed by Supabase (Postgres) — every other module reads/writes tickets through its functions, never the database directly. `backend/migrations/0001_init_schema.sql` is the schema; `backend/legacy_json_backup/` holds the pre-migration JSON files as a rollback reference only, not read by the app.

**The pipeline** (`agent_runner.run_pipeline`, called from `POST /api/run` and the Slack/scheduler path): fetch tickets → `risk_engine.tag_tickets` → `nudge_generator`/`summary_generator` (Claude, with deterministic fallback on failure) → `health_score.compute_health_score` + persist to the Supabase `health_history` table. A step failing doesn't crash the run — the result comes back `partial: true` with per-step error strings. Nudges and standup are **never dropped silently**: on Claude failure they fall back to text built directly from the ticket/sprint data rather than skipping the owner or returning nothing (`nudge_generator._fallback_nudge_message`, `summary_generator._fallback_standup`).

**Multi-project data isolation**: `health_history` rows carry a `project_id` column with a `unique (project_id, date)` constraint; `health_score.load_history(project_id)` filters by it and `save_health_entry` upserts on that pair, then prunes to `MAX_HISTORY_ENTRIES` **per project** — don't regress this back to a single shared, unfiltered history (that was the pre-Supabase JSON file's actual behavior — a global cap across all projects combined — fixed during the migration, not the intended design).

**Auth is UI-only**: `backend/auth.py` (demo credentials, in-memory bearer sessions) gates the frontend's login screen via `AuthGate` in `App.jsx`, but `require_auth` is not applied to any data route — every `/api/projects/...` endpoint is reachable unauthenticated regardless of login state. This is intentional for a showcase deployment; don't assume login implies API-level protection.

**Frontend data flow**: `ProjectProvider` holds the current project (persisted to `localStorage`); most pages fetch their own data directly in a `useEffect` keyed on `projectId` (no shared polling loop). `useSprint()` is the one shared hook (used by Dashboard/ReportsPage) and also re-fetches when `useAgentRun().runVersion` increments after a run completes. There is no polling on page *data* otherwise — the only two intervals in the app are the agent-run status endpoint (every 2s, `frontend/src/utils/runPolling.js`'s `RUN_POLL_INTERVAL_MS`, shared by `useAgentRun`'s live-run poller and `AllProjectsPage`'s sequential "Run all") while a run is in progress, and `useAuth`'s session-expiry check (`GET /api/auth/me` every 60s while logged in).

**Risk-tag thresholds** (`STALE_THRESHOLD_HOURS`, `STUCK_THRESHOLD_PCT`, `SPRINT_TOTAL_DAYS`) live in Supabase's `runtime_settings` table (editable from the Settings page via `PUT /api/settings/runtime`), not `.env`. `risk_engine.py` itself stays pure — it never reads Supabase; callers (`kanban`, `analytics`, `reports`, `team_insights`, `agent_runner`) fetch `runtime_settings.get_thresholds()` once per entry point and pass the result into `risk_engine.tag_tickets(..., thresholds=...)`. That function caches reads (invalidated on write, 5s TTL as a safety net) so thresholds are never hardcoded but also never round-trip to Supabase per ticket — keep this in mind if you change the thresholds, and don't hardcode them elsewhere either (`team_insights.py`'s `REASON_TEMPLATES` currently hardcodes the default values as prose).

**Tailwind**: utility classes only, always as complete literal strings — `frontend/src/utils/riskColors.js` is the one place per-status/per-risk-tag classes live. Tailwind purges anything built via string concatenation, so never construct a class name dynamically.
