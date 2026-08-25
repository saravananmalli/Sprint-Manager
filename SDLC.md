# SDLC & Architecture — Agile Sprint Management Agent


> **Audience:** developers joining this project who need to ship a new feature without reading every file first.
> **Scope:** what's actually built today, how the pieces connect, and the exact recipes for extending each layer.
> **Accuracy note:** this file is a description of the code, not an aspiration. If you add or remove a route/module, update the table in the same PR — a stale architecture doc is worse than no doc.


---


## 1. Quick orientation


| You want to… | Jump to |
| --- | --- |
| Understand the system at a glance | [§3 Architecture](#3-architecture) |
| Find which file owns a behaviour | [§5 Module catalogue](#5-module-catalogue) |
| Add a new API endpoint | [§9.1 Add a backend endpoint](#91-add-a-new-backend-endpoint) |
| Add a new pipeline step | [§9.2 Add a pipeline step](#92-add-a-new-pipeline-step) |
| Add a new risk rule | [§9.3 Add a risk rule](#93-add-a-new-risk-rule) |
| Add a new automation rule | [§9.4 Add an automation rule](#94-add-an-automation-rule) |
| Add a new frontend page | [§9.5 Add a frontend page](#95-add-a-new-frontend-page) |
| Add a new chart / dashboard widget | [§9.6 Add a chart / widget](#96-add-a-chart--widget) |
| Connect to live Jira instead of mock data | [§10.5 Live Jira](#105-live-jira) |
| Create/import a project, or wire a real git webhook | [§10.6 Project import & webhooks](#106-project-import--webhooks) |
| Run tests / set env vars | [§10 Operations](#10-operations) |


---


## 2. SDLC flow for this repo


A feature moves through six stages. Each stage names the **artefact produced** and the **gate** that must pass before moving on.


```
   ┌────────────┐   ┌─────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌──────────────┐
   │ 1. Intake  │──▶│ 2. Design   │──▶│ 3. Build   │──▶│ 4. Test    │──▶│ 5. Verify  │──▶│ 6. Release   │
   └────────────┘   └─────────────┘   └────────────┘   └────────────┘   └────────────┘   └──────────────┘
   issue / ask      sketch + API     code + types     pytest +         run app +         merge + tag
   in CLAUDE.md     contract         + JSON shape     manual UI        screenshot        scheduler ON
```


| Stage | Artefact | Gate |
| --- | --- | --- |
| 1. Intake | One-paragraph problem statement in the PR description or CLAUDE.md "Definition of done" checklist. | The "why" is written down. |
| 2. Design | API contract (path, method, request/response JSON), data file shape, UI sketch. Land in PR description. | Reviewer agrees the contract is minimal and consistent with §6 conventions. |
| 3. Build | Backend module + route, frontend fetch call, page/component. | `uvicorn` boots and `npm run build` succeeds. |
| 4. Test | Unit test in `backend/tests/` for any new pure logic. Manual UI walk-through for any new screen. | `pytest tests/` is green. Screenshot or short note in PR. |
| 5. Verify | Real run against mock data (`USE_MOCK_DATA=true`) — agent pipeline must still complete end-to-end. | `POST /api/run?project=<id>` returns `done` and the dashboard refreshes. |
| 6. Release | Merge to main. If the feature has a scheduled effect, confirm `SCHEDULER_ENABLED=true` and the daily cron picks it up. | Slack status page shows green for the affected project(s). |


**Non-negotiables (from CLAUDE.md):**
- Always use `claude-sonnet-4-6` for LLM calls.
- Risk thresholds live in `.env`, not in code.
- Tailwind utility classes only — no custom CSS files, no dynamic class concatenation.
- Never crash the pipeline on a single step failure — wrap external calls in try/except and continue.


---


## 3. Architecture


### 3.1 System diagram


```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite + Tailwind + Recharts)                                │
│  Providers:  ErrorBoundary → Theme → Toast → Project → AgentRun                 │
│  Routes:     /  /all-projects  /kanban  /team  /reports  /analytics  /slack     │
│              /settings                                                          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │  axios  (VITE_API_BASE_URL → :8000)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FastAPI backend  (main.py — 26 routes, lifespan starts/stops the scheduler)    │
│                                                                                 │
│   ┌──────────────┐   Agent pipeline (agent_runner.run_pipeline, background)    │
│   │ POST /api/run│──▶ jira_client → risk_engine → health_score                │
│   │ (BackgroundTasks)                ▼                                         │
│   └──────────────┘     nudge_generator + summary_generator  (Claude API)        │
│                                          ▼                                      │
│                        cached in main.latest_results[project_id]                │
│                                          ▼                                      │
│                          slack_sender · reports.py (PDF/email) · kanban.py      │
└────────────┬───────────────────────────────────────────┬────────────────────────┘
             │                                           │
   ┌─────────▼──────────┐                ┌───────────────▼────────────────────┐
   │  Anthropic API      │                │  Persistence (Supabase/Postgres)   │
   │  claude-sonnet-4-6  │                │  projects, tickets, team_members,  │
   └─────────────────────┘                │  health_history, slack_config,     │
   ┌─────────────────────┐                │  runtime_settings, activity_log —  │
   │  Live Jira (opt-in) │                │  see backend/migrations/           │
   │  Agile REST API     │                └────────────────────────────────────┘
   └─────────────────────┘                ┌────────────────────────────────────┐
   ┌─────────────────────┐                │  APScheduler (scheduler.py)        │
   │  Slack webhook /     │                │  daily cron → run + post every    │
   │  bot token           │                │  project when SCHEDULER_ENABLED   │
   └─────────────────────┘                └────────────────────────────────────┘
   ┌─────────────────────┐                ┌────────────────────────────────────┐
   │  SMTP (optional,     │                │  POST /api/webhooks/git             │
   │  via reports.py)     │                │  HMAC-signed, drives kanban.py      │
   └─────────────────────┘                └────────────────────────────────────┘
```


### 3.2 Layered view


```
PRESENTATION    React pages, components, providers (frontend/src/)
                ▲ axios (via a single client.js instance — see §5.3)
─────────────────────────────────────────────────────────────────
HTTP API        FastAPI routes (backend/main.py)
                ▲
─────────────────────────────────────────────────────────────────
ORCHESTRATION   agent_runner.py — fetch → tag risk → nudge → standup → health
                scheduler.py — cron trigger only, calls back into main.py
                ▲
─────────────────────────────────────────────────────────────────
DOMAIN          risk_engine · health_score · team_insights · kanban
                · analytics · reports · runtime_settings
                (pure Python except reports.py's SMTP call — see §10.3)
                ▲
─────────────────────────────────────────────────────────────────
EXTERNAL        jira_client · nudge_generator · summary_generator
                · slack_sender · slack_config · sprint_importer
                (all have graceful fallbacks — see §10.3)
                ▲
─────────────────────────────────────────────────────────────────
DATA            JSON files in backend/ (see §7) + projects_store.py
                (the in-memory layer every other module reads through)
```


Rules of thumb:
- **Domain modules** must stay pure — no Slack, no Claude, no HTTP. Tests in `backend/tests/` enforce this.
- **External modules** must each define a fallback path for when their integration is offline.
- **Routes** in `main.py` orchestrate — they call domain + external modules but contain no business rules themselves.
- **`projects_store.py`** is the source of truth for project/ticket state, backed by Supabase. Every other module reads tickets through it (directly, or via `jira_client.load_tickets`) — nothing else touches the database directly.


---


## 4. End-to-end flows


### 4.1 "Run agent" button → dashboard refresh


```
User clicks Run in Header.jsx
  │
  ▼
useAgentRun().runAgent() — [frontend/src/hooks/useAgentRun.jsx]
  │   POST /api/run?project=<id>  → 202 { run_id, status: "running" }
  ▼
main.py:post_run() schedules a BackgroundTask → _execute_run(run_id, project_id)
  │
  ▼
agent_runner.run_pipeline(project_id, steps=["all"])
  ├─ build_sprint_snapshot: jira_client.load_tickets(project) (live or mock/seed)
  │                          → risk_engine.tag_tickets → health_score.compute_velocity
  ├─ nudge_generator.generate_nudges(snapshot)      ◀── Claude, one call per assignee
  ├─ summary_generator.generate_standup(snapshot)   ◀── Claude, 4-section digest
  └─ health_score.compute_health_score + save_health_entry → Supabase health_history table
  │
  ▼ result cached in main.latest_results[project_id]; run state in main.runs[run_id]
  ▼
Frontend polls GET /api/run/status?run_id=<id> every 2s (useAgentRun)
  │   { status: "done" | "partial" | "error", step: "...", progress: 0-100 }
  ▼
On completion, useAgentRun bumps `runVersion` → useSprint() (and any page fetching
  fresh data) re-fetches /sprint + /health for the current project
```


Note: a run does **not** post to Slack by itself — that's a separate, explicit step (§4.2 or the "Send to Slack" button on `/slack`, both backed by `main._run_and_post`).


### 4.2 Slack delivery — manual button, or the daily scheduler


```
Either:
  User clicks "Send to Slack" on SlackPage.jsx → POST /api/slack/send/{project_id}
Or:
  scheduler.py fires main._run_all_projects_and_post() daily at SCHEDULER_TIME_UTC
  (only when SCHEDULER_ENABLED=true — disabled by default, see §10.5)
  │
  ▼ both paths call main._run_and_post(project_id):
  │
  ├─ agent_runner.run_pipeline(project_id, steps=["all"])   (same pipeline as §4.1)
  ├─ latest_results[project_id] = result
  ├─ agent_runner.post_to_slack(result, project_id, post_type="all")
  │    → slack_sender.send_health_score / send_standup / send_nudge
  └─ slack_config.mark_run(project_id)   → upserts a row in Supabase's slack_config table
```


### 4.3 Kanban: manual drag, demo "Simulate" button, and the real git webhook


```
Three ways a ticket's status/column changes, all funneling through kanban.py:

1. Drag-and-drop on /kanban
   → POST /api/projects/{id}/kanban/move { ticketId, toColumn }
   → kanban.move_ticket(...)  — moves unconditionally, actor="you"

2. "Simulate push/PR/merge" buttons on /kanban (demo — no real git host involved)
   → POST /api/projects/{id}/kanban/simulate { event }
   → kanban.simulate_event(...) — picks the *first* ticket currently in the
     rule's `from` column and advances it. Good for demos; not identity-aware.

3. A real CI/git host
   → POST /api/webhooks/git { project, event, ticketIds: [...], actor }
     signed with X-Webhook-Signature: HMAC-SHA256(GIT_WEBHOOK_SECRET, raw_body)
   → kanban.apply_webhook_event(...) — transitions each named ticket that's
     eligible; skips (doesn't error on) tickets that aren't, since one payload
     can reference tickets in mixed states. See §10.6.

All three write to `projects_store.append_activity(project_id, entry)`, which
KanbanPage.jsx renders as the "Automation activity" feed (in-memory, last 50).
```


---


## 5. Module catalogue


### 5.1 Backend modules


| File | Purpose | External deps | Persists to |
| --- | --- | --- | --- |
| [backend/main.py](backend/main.py) | FastAPI app + 26 REST routes; lifespan starts/stops the scheduler; in-memory run state | — | — (in-memory `runs`, `latest_results`) |
| [backend/agent_runner.py](backend/agent_runner.py) | Orchestrates fetch → risk → nudge → standup → health; CLI entry point | — | — |
| [backend/jira_client.py](backend/jira_client.py) | Live Jira Agile REST connector; falls back to mock/seed tickets on any failure | requests, JIRA_* env | — |
| [backend/projects_store.py](backend/projects_store.py) | Supabase-backed multi-project store — source of truth for tickets/team; create/delete/reset | supabase-py | Supabase: `projects`, `tickets`, `seed_tickets`, `team_members`, `activity_log` |
| [backend/sprint_importer.py](backend/sprint_importer.py) | Parses an uploaded CSV into canonical tickets | — | — |
| [backend/risk_engine.py](backend/risk_engine.py) | Velocity math + risk tagging (`STALE`, `STUCK`, `BLOCKED`, `UNASSIGNED`, `INCOMPLETE_AC`) — stays pure; thresholds are passed in by callers, never fetched here | — | — |
| [backend/health_score.py](backend/health_score.py) | Velocity/health-score math + trend + history persistence | supabase-py | Supabase: `health_history` |
| [backend/kanban.py](backend/kanban.py) | Kanban board assembly + automation rule engine (manual move / simulate / real webhook) | — | (via `projects_store.update_ticket` / `append_activity`) |
| [backend/team_insights.py](backend/team_insights.py) | Per-member workload, risk level, deterministic (non-LLM) insight text | — | — |
| [backend/reports.py](backend/reports.py) | Leadership report: deterministic text, PDF export, SMTP email | fpdf2, smtplib | — |
| [backend/analytics.py](backend/analytics.py) | `/analytics` page data (risk distribution, points per assignee, etc.) | — | — |
| [backend/nudge_generator.py](backend/nudge_generator.py) | Per-assignee nudge messages | Anthropic API, tenacity | — |
| [backend/summary_generator.py](backend/summary_generator.py) | 4-section standup digest | Anthropic API, tenacity | — |
| [backend/slack_sender.py](backend/slack_sender.py) | Slack delivery (webhook or bot token) | requests, SLACK_* env | — |
| [backend/slack_config.py](backend/slack_config.py) | Scheduler status, per-project channel mapping, last-run tracking | supabase-py | Supabase: `slack_config` |
| [backend/runtime_settings.py](backend/runtime_settings.py) | Runtime-editable settings surfaced on `/settings`; also exposes `get_thresholds()` (cached) for risk-tag thresholds | supabase-py | Supabase: `runtime_settings` |
| [backend/scheduler.py](backend/scheduler.py) | Thin APScheduler wrapper — daily cron, generic `run_callback` | apscheduler | — |


### 5.2 Frontend pages


| Route | File | Composes |
| --- | --- | --- |
| `/` | [Dashboard.jsx](frontend/src/pages/Dashboard.jsx) | SprintHealthPanel, BurndownChart, HealthTrendPanel, TeamWorkloadPanel, ActivityPanel, MetricsSummary |
| `/all-projects` | [AllProjectsPage.jsx](frontend/src/pages/AllProjectsPage.jsx) | Portfolio stat tiles, project list, "Run all", "New project" (NewProjectModal), per-project delete |
| `/kanban` | [KanbanPage.jsx](frontend/src/pages/KanbanPage.jsx) | Drag-and-drop columns, automation rules card, simulate buttons, activity feed |
| `/team` | [TeamPage.jsx](frontend/src/pages/TeamPage.jsx) | Team roster + per-member workload/risk detail |
| `/reports` | [ReportsPage.jsx](frontend/src/pages/ReportsPage.jsx) | Leadership report (+ PDF/email), standup, nudges |
| `/analytics` | [AnalyticsPage.jsx](frontend/src/pages/AnalyticsPage.jsx) | Risk distribution, points per assignee, ticket table/filters |
| `/slack` | [SlackPage.jsx](frontend/src/pages/SlackPage.jsx) | Scheduler status, channel table, "Send to Slack" |
| `/settings` | [SettingsPage.jsx](frontend/src/pages/SettingsPage.jsx) | Theme, runtime settings |


### 5.3 Frontend cross-cutting


| Layer | Files | Notes |
| --- | --- | --- |
| Providers | `hooks/useTheme.jsx`, `hooks/useToast.jsx`, `hooks/useProjects.jsx`, `hooks/useAgentRun.jsx` | Each file exports both the Provider and its `useX()` hook. Order in [App.jsx](frontend/src/App.jsx): ErrorBoundary → Theme → Toast → Project → AgentRun. |
| Hooks | [useSprint.js](frontend/src/hooks/useSprint.js) | Fetches `/sprint` + `/health` for the current project in parallel; re-fetches when `useAgentRun().runVersion` changes (i.e. after a run completes). Used by Dashboard and ReportsPage — other pages fetch their own endpoint directly in a `useEffect`. |
| API client | [src/api/client.js](frontend/src/api/client.js) | A single configured axios instance + response error-normalizer. **Not** a wrapper library — pages call `client.get('/api/...')` inline with literal URLs. |
| Layout | [Sidebar.jsx](frontend/src/components/layout/Sidebar.jsx), [Header.jsx](frontend/src/components/layout/Header.jsx), [CommandPalette.jsx](frontend/src/components/layout/CommandPalette.jsx) | App.jsx owns global keyboard shortcuts (`g d`, `g a`, `g s`, `r`, `?`, `Ctrl/Cmd K`) directly — there's no separate `useHotkeys` hook. |
| UI primitives | `components/common/` — Card, Skeleton, Spinner, StatTile, Toast, BackendBanner, FloatingAiButton | Small and few by design — modals (e.g. [NewProjectModal.jsx](frontend/src/components/projects/NewProjectModal.jsx), the shortcuts cheatsheet in App.jsx) are built inline per-use rather than through a shared Modal component. Reuse what exists before adding a new primitive. |
| Utilities | [formatters.js](frontend/src/utils/formatters.js), [riskColors.js](frontend/src/utils/riskColors.js) | Tailwind class maps for risk tags / sprint status / priority live in `riskColors.js` — always full class strings (see §10.1 non-negotiables). |


---


## 6. API contract conventions


Match these when adding new routes — note the two conventions that actually coexist (this used to be documented as one rule; it isn't):


| Concern | Convention |
| --- | --- |
| Project scoping (resource-style routes) | `/api/projects/{project_id}/...` — path param. Used by sprint, health, kanban, reports, analytics, nudges. |
| Project scoping (action-style routes) | `?project=<id>` — query param. Used by `POST /api/run` (predates the path-param convention; kept for backward compatibility with `useAgentRun`). `GET /api/team` and `GET /api/team/{email}` also accept an *optional* `?project=` filter. |
| Response shape | Success → 200 with JSON, no envelope (`{data:...}` etc.). Error → 4xx/5xx with `{"error": "human readable"}` (see the exception handlers at the top of `main.py`). |
| Long-running work | `/api/run` returns 202 immediately via `BackgroundTasks`; client polls `/api/run/status?run_id=`. Never block the request thread on Claude calls. |
| Caching | `latest_results[project_id]` (in-memory, in `main.py`) holds the latest pipeline output. `/nudges` and `/reports/standup` read from it and return an empty/404 default if no run has happened yet. |
| External call failures | Retry once with `tenacity` (Claude only), then return a fallback payload. Never raise to the route layer. Live Jira failures fall back to mock/seed tickets (§10.5); missing Slack/SMTP config returns `{"method": "skipped"}`-style payloads, not an error. |
| Persistence writes | All writes go through Supabase (via `supabase-py`) — Postgres transactions/upserts replace the old `FileLock`-protected JSON writes. `create_project` calls a single `create_project_with_tickets` Postgres RPC so the project + tickets + team-member rows commit atomically. `health_history` is capped at 30 entries **per project** (enforced by `health_score.save_health_entry` after each write); `activity_log` is capped at 50 per project at query time (`ORDER BY at DESC LIMIT 50`), not by deleting rows. |
| Webhooks | `POST /api/webhooks/git` is the one route that reads the raw request body itself (for HMAC verification) instead of taking a Pydantic body param directly — see [kanban.py](backend/kanban.py) and §10.6. |


### 6.1 Full route list


See [§5.1](#51-backend-modules) for which module each route calls.


- **Projects** — `GET/POST /api/projects`, `POST /api/projects/import` (multipart CSV), `DELETE /api/projects/{id}`, `GET /api/projects/{id}/sprint`, `GET /api/projects/{id}/health`
- **Kanban** — `GET /api/projects/{id}/kanban`, `POST /api/projects/{id}/kanban/{simulate|move|reset}`
- **Webhooks** — `POST /api/webhooks/git` (HMAC-signed when `GIT_WEBHOOK_SECRET` is set)
- **Team** — `GET /api/team`, `GET /api/team/{email}` (both accept `?project=`)
- **Reports** — `GET /api/projects/{id}/reports/{leadership|pdf|standup}`, `POST /api/projects/{id}/reports/email`
- **Analytics** — `GET /api/projects/{id}/analytics`
- **Agent control** — `POST /api/run?project=`, `GET /api/run/status?run_id=`
- **Nudges** — `GET /api/projects/{id}/nudges`, `POST /api/projects/{id}/nudges/send`
- **Slack** — `GET /api/slack/overview`, `POST /api/slack/send/{project_id}`
- **Settings** — `GET/PUT /api/settings/runtime`


26 routes total. There is no `/api/employees`, `/api/comments`, or `/api/escalations` route — team insight and risk-escalation signal are folded into `team_insights.py` / `/api/team`, not separate subsystems.


---


## 7. Data model


### 7.1 Ticket shape (canonical)


```json
{
  "id": "CHK-108",
  "summary": "Wire fraud-detection service into checkout flow",
  "status": "In Progress",
  "assignee": { "name": "Priya Sharma", "email": "priya.sharma@example.com" },
  "storyPoints": 3,
  "priority": "P0",
  "priorityLabel": "Urgent",
  "lastUpdated": "2026-07-30T11:00:00Z",
  "createdAt": "2026-07-28T09:00:00Z",
  "blockers": ["PROJ-201 - Risk service API contract not finalized"],
  "acceptanceCriteria": "Fraud score returned by risk service blocks checkout above threshold.",
  "riskTags": ["BLOCKED"]
}
```


`riskTags` is populated by `risk_engine.tag_tickets` at snapshot-build time — it's never stored on disk and never set manually. Tickets from live Jira, CSV import, and manual creation are all normalized to this same shape before they reach `risk_engine` (see [jira_client.py](backend/jira_client.py), [sprint_importer.py](backend/sprint_importer.py)).


### 7.2 Persistence map

All state lives in Supabase (Postgres) — see `backend/migrations/0001_init_schema.sql` for the full DDL and `backend/migrations/seed_supabase.py` for the one-time script that loaded the original JSON seed data. Pre-migration JSON files are kept at `backend/legacy_json_backup/` as a rollback reference only; nothing in the app reads them.

| Table | Owner module | Bounded | Notes |
| --- | --- | --- | --- |
| `projects` / `seed_tickets` | projects_store | — | `projects.is_seed` marks the 4 original seed projects (read-only origin; can't be deleted). `seed_tickets` is a read-only snapshot each seed project's original tickets — `reset_project` restores from here, replacing what the immutable JSON file used to provide "for free". |
| `tickets` | projects_store | — | One row per ticket, `(project_id, id)` composite PK — ticket ids like `CHK-101` are only unique within a project, not globally. `riskTags` is never stored; still computed at read time by `risk_engine.tag_tickets`. |
| `team_members` | projects_store | — | Global, not per-project (`GET /api/team` returns one shared list) — matches pre-migration behavior. |
| `health_history` | health_score | 30 entries **per project** | `unique (project_id, date)`; `save_health_entry` upserts on that pair, then prunes each project's own history to 30 — see the fixed gotcha below. |
| `slack_config` | slack_config | — | One row per project, `{project_id, last_run_at}` — replaces the old `{ lastRun: { <project_id>: ... } }` blob. |
| `runtime_settings` | runtime_settings | — | Key/value rows for the 4 `EDITABLE_KEYS`; `get_thresholds()` caches a read (invalidated on write, 5s TTL) so `risk_engine.tag_tickets` callers don't round-trip to Supabase per ticket. |
| `activity_log` | projects_store | 50 per project (query-time) | Per-ticket status-change history shown on Kanban. **New in the Supabase migration** — this was in-memory-only before (capped at 50, lost on every restart), never file-persisted; it's a genuine durability improvement, not a straight swap. |


**Fixed gotcha:** the old `health_history.json` was a single shared file with a cap of 30 entries **across all projects combined** — a run for any project could evict another project's history. The Supabase migration fixed this: `health_history` now caps at 30 entries **per project** (`unique (project_id, date)` + a per-project prune query in `save_health_entry`).


**Rule:** any new persistent state must go in Supabase — add a table (or columns) to `backend/migrations/`, and thread it through the owning module's existing function API rather than querying Supabase directly from callers.


---


## 8. State + data flow on the frontend


```
ProjectProvider (projects list + currentProjectId, persisted to localStorage)
        │
        ▼ currentProjectId changes
        │
Each page fetches what it needs directly:
        │   Dashboard / ReportsPage → useSprint() → GET /sprint + /health (parallel)
        │   KanbanPage             → GET /kanban  (own useEffect)
        │   TeamPage               → GET /team    (own useEffect)
        │   AnalyticsPage          → GET /analytics (own useEffect)
        │   SlackPage              → GET /slack/overview (own useEffect)
        │
        ▼
Components render — Tailwind classes resolved from riskColors.js
```


There is **no polling interval** on page data (unlike the agent run status, which polls every 2s while running). Pages re-fetch when `projectId` changes, or — for Dashboard/ReportsPage — when `useAgentRun().runVersion` increments after a run finishes. Everything else is fetch-once-per-mount; click "Refresh" (AllProjectsPage) or navigate away and back to force a re-fetch elsewhere.


---


## 9. Extension playbook


### 9.1 Add a new backend endpoint


1. **Decide where the logic lives.** If it's pure logic, add it to (or create) a domain module in `backend/`. Keep domain modules free of HTTP/Slack/Claude.
2. **Write a unit test first** in `backend/tests/test_<module>.py`.
3. **Add the route** to [backend/main.py](backend/main.py). Follow [§6](#6-api-contract-conventions): path param for resource-style routes, `{"error": ...}` for errors, no envelope.
4. **Call it from the page** with `client.get('/api/...')` (or add a small helper if three or more pages will call it — there's no wrapper layer to extend, see §5.3).


### 9.2 Add a pipeline step


The pipeline is `agent_runner.run_pipeline`, called from `main._execute_run` (via `/api/run`) and `main._run_and_post` (Slack/scheduler path).


1. Build a pure function in a new domain module: `def compute_thing(tickets, sprint) -> dict`.
2. Add a test in `backend/tests/test_thing.py`.
3. Call it inside `run_pipeline`, after `build_sprint_snapshot`. Add its output to the `result` dict and report progress via the `report(step_name, pct)` closure.
4. If it should appear in Slack, extend `agent_runner.post_to_slack`.
5. If the frontend should see it, expose a `GET /api/projects/{id}/<thing>` route that reads from `latest_results[project_id]`.


### 9.3 Add a risk rule


All risk rules live exclusively in [backend/risk_engine.py](backend/risk_engine.py). Do not duplicate them.


1. Add the rule inside `tag_ticket(ticket, now, thresholds)`. Read any new threshold from `thresholds` (`risk_engine.py` stays pure — it never fetches this itself; callers pass it in, sourced from `runtime_settings.get_thresholds()`) — never hardcode.
2. If the rule needs a new configurable threshold: add it to `EDITABLE_KEYS` and `_DEFAULTS` in `runtime_settings.py`, add a seed row for it in `migrations/seed_supabase.py`, and include it in `get_thresholds()`'s returned dict. Document the default in `.env.example` (used only by the seed script) and [§10.1](#101-environment-variables).
3. Add a test case to [backend/tests/test_risk_engine.py](backend/tests/test_risk_engine.py).
4. Add the new tag to [frontend/src/utils/riskColors.js](frontend/src/utils/riskColors.js) — use a **full** Tailwind class string (no concatenation; Tailwind purges dynamic class names).


### 9.4 Add an automation rule


Rules are defined in [backend/kanban.py](backend/kanban.py) → `AUTOMATION_RULES`.


1. Add a rule entry: `{"event": "git.review_requested", "from": "Testing", "to": "In Review", "description": "..."}`.
2. It's picked up automatically by all three paths in [§4.3](#43-kanban-manual-drag-demo-simulate-button-and-the-real-git-webhook) — manual move doesn't use rules, but simulate and the real webhook both key off `_RULE_BY_EVENT`.
3. Add a "Simulate" button on [KanbanPage.jsx](frontend/src/pages/KanbanPage.jsx) if developers should be able to fire it without a real webhook.


### 9.5 Add a frontend page


1. Create `frontend/src/pages/MyPage.jsx`. Compose it from existing `components/common/*` primitives — do not invent new ones without checking §5.3 first.
2. Register the route in [App.jsx](frontend/src/App.jsx)'s `<Routes>`.
3. Add a nav entry in [Sidebar.jsx](frontend/src/components/layout/Sidebar.jsx).
4. If it's a primary destination, add a `g <key>` shortcut to the `GO_TO_ROUTES` map and `SHORTCUTS` list in App.jsx.
5. If it consumes sprint data reused elsewhere, consider `useSprint()`; otherwise fetch directly in a `useEffect` like KanbanPage/TeamPage do.


### 9.6 Add a chart / widget


1. Dashboard-specific widgets go in `frontend/src/components/dashboard/`.
2. Pass data in via props — fetch/derive it at the page level, not inside the chart component.
3. Reuse the existing Recharts patterns in [BurndownChart.jsx](frontend/src/components/dashboard/BurndownChart.jsx) / [HealthTrendPanel.jsx](frontend/src/components/dashboard/HealthTrendPanel.jsx) for consistent theming.


---


## 10. Operations


### 10.1 Environment variables


All env vars are read at runtime — never hardcoded. Authoritative list lives in [backend/.env.example](backend/.env.example); summary below.


| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **Required, always** — the persistence layer (§7.2). Hosted project or the Supabase CLI's local stack (`supabase start`). `projects_store.py`/`health_score.py`/`slack_config.py`/`runtime_settings.py` all construct their Supabase client at import time, so these must be set before `main.py`/`agent_runner.py` import them — both files call `load_dotenv()` before any other local import for exactly this reason. |
| `ANTHROPIC_API_KEY` | Claude API key. If missing, nudges + standup fall back to deterministic templates. |
| `USE_MOCK_DATA` | Editable at runtime via the Settings page, stored in Supabase's `runtime_settings` table (not read from `.env` at request time — see §7.2). `true` (default): always use the seeded project/ticket data. `false`: fetch live from Jira per-project (§10.5), falling back to mock/seed on any error. The `.env`/`.env.example` value is only the initial row `migrations/seed_supabase.py` writes when bootstrapping a fresh Supabase project. |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_BOARD_ID` / `JIRA_SPRINT_ID` | Live Jira credentials — board/sprint IDs are a global fallback; a project can override them via the `projects.jira_board_id`/`jira_sprint_id` columns (§10.5). |
| `JIRA_STORY_POINTS_FIELD` / `JIRA_AC_FIELD` | Jira custom field IDs — vary per instance. |
| `STALE_THRESHOLD_HOURS` / `STUCK_THRESHOLD_PCT` / `SPRINT_TOTAL_DAYS` | Risk-tagging thresholds. Same Supabase-backed, runtime-editable pattern as `USE_MOCK_DATA` above — defaults 24 / 50 / 10. |
| `SLACK_WEBHOOK_URL` / `SLACK_BOT_TOKEN` | Slack delivery. |
| `GIT_WEBHOOK_SECRET` | Shared secret for `POST /api/webhooks/git` HMAC verification. Unset = unsigned/insecure (fine for local demo only) — see §10.6. |
| `SCHEDULER_ENABLED` / `SCHEDULER_TIME_UTC` | Daily cron over all projects. Default `false` / `09:00`. See §10.5. |
| `EMAIL_DRY_RUN` / `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_RECIPIENTS_<PREFIX>` | SMTP delivery for `reports.send_email`, keyed by each project's `prefix`. |
| `CORS_ORIGIN` | Frontend origin the backend accepts requests from. Default `http://localhost:5173`. |
| `LOG_LEVEL` | Default `INFO`. |


Frontend `.env`: `VITE_API_BASE_URL` (default `http://localhost:8000`).


### 10.2 Commands


```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/                       # run all tests
python agent_runner.py --mock       # run full pipeline once from CLI
python agent_runner.py --step risk  # one step only


# Frontend
cd frontend
npm install
npm run dev                         # http://localhost:5173
npm run build                       # production bundle


# CORS note: if you run the frontend on a non-default port (Vite auto-bumps
# to 5174/5175/... when 5173 is taken), set CORS_ORIGIN in backend/.env to
# match, or requests will fail as an opaque "Network Error" in the browser.
```


### 10.3 Fallback matrix


| Integration offline | Behaviour |
| --- | --- |
| No `ANTHROPIC_API_KEY` | `nudge_generator` and `summary_generator` use deterministic templates. |
| Anthropic API call fails | tenacity retries once after a short wait, then falls back as above. |
| `USE_MOCK_DATA=false` but Jira unreachable / 401 / empty sprint | `jira_client.load_tickets` logs the error and returns the project's mock/seed tickets — the run still completes. |
| `SLACK_WEBHOOK_URL` and `SLACK_BOT_TOKEN` both missing | `slack_sender` calls return `ok: False`; `post_to_slack` counts them as skipped. Pipeline continues. |
| `SMTP_HOST` or the project's `EMAIL_RECIPIENTS_<PREFIX>` missing, and `EMAIL_DRY_RUN` not `true` | `reports.send_email` returns `{"sent": false, "detail": "Set SMTP_HOST + ..."}`. |
| `GIT_WEBHOOK_SECRET` unset | `/api/webhooks/git` accepts unsigned requests (logged as a startup warning) — fine for local demo, not for an internet-facing deployment. |
| Pipeline step (nudge/summary/health) raises | Step is logged, run continues with `partial: true`. The final result includes whichever pieces succeeded. |


### 10.4 Testing


| Test file | Covers |
| --- | --- |
| `tests/test_risk_engine.py` | Risk tags, threshold boundaries. |
| `tests/test_health_score.py` | Velocity, health score, trend, history persistence. |
| `tests/test_summary_generator.py` | Fallback standup, 4-section structure. |
| `tests/test_jira_client.py` | Issue-shape mapping, live-config resolution, auth/network fallback to mock. |
| `tests/test_sprint_importer.py` | CSV parsing, column aliases, validation errors. |
| `tests/test_projects_store.py` | Project create/delete/reset, ID collision handling, seed-project protection. Runs against the same Supabase project the app uses — each test tracks and cleans up only the rows it creates (never truncates a table or touches seed data). |
| `tests/test_main_routes.py` | Integration tests (FastAPI `TestClient`) for project create/import/delete and the git webhook (signature verification, eligible/ineligible tickets). Same Supabase-cleanup pattern as above, plus restores the default seed project's tickets/activity after each test since the webhook tests mutate it. |


**Every new domain module needs a matching test file.** Thin external wrappers (`slack_sender`, `nudge_generator`) don't need unit tests if they're pass-throughs — exercise them via a manual run instead.

**Supabase-backed tests**: there's no disposable local Postgres/Supabase CLI stack wired up yet — tests run against the real Supabase project via `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`. Follow the existing pattern in `test_projects_store.py`/`test_main_routes.py`/`test_health_score.py`: track project ids and team-member emails that exist *before* the test, and after it delete only what the test itself created (`delete_project` cascades to that project's tickets/health_history/activity_log; `team_members` has no FK to a project, so clean those up separately by email). Never truncate a table or delete a seed project's data.


### 10.5 Live Jira


Set `USE_MOCK_DATA=false` (via the Settings page — see §10.1) plus `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` in `backend/.env`. By default every project pulls from the same `JIRA_BOARD_ID`/`JIRA_SPRINT_ID`; a project can override this via the `jira_board_id`/`jira_sprint_id` columns on its `projects` row (surfaced to `jira_client.py` as `project["jiraBoardId"]`/`project["jiraSprintId"]`, same dict keys as before the Supabase migration).


`jira_client.load_tickets(project)` returns `(tickets, source)` where `source` is `"live"` or `"mock"`. `agent_runner.build_sprint_snapshot` only recomputes `totalCommitted`/`pointsDone` from the ticket set when `source == "live"` — for mock/seed projects those numbers were originally curated by hand in `projects_data.json` (now `backend/legacy_json_backup/projects_data.json`, loaded into Supabase once by `migrations/seed_supabase.py`) and are **not** simply `sum(storyPoints)` (don't "fix" this without checking — it's intentional, see the comment in `jira_client.py`).


A live-mode run that fails (auth, network, empty sprint) logs the error and transparently falls back to that project's mock/seed tickets — it never surfaces as a pipeline error.


### 10.6 Project import & webhooks


**Creating projects** — two routes, both funnel into `projects_store.create_project`, which persists via the `create_project_with_tickets` Postgres RPC (a single transaction covering the `projects` row, its `tickets` rows, and any new `team_members` rows — see §7.2):
- `POST /api/projects` — JSON body (name, teamSlug, sprintName, dates, prefix, optional `tickets[]`). An empty ticket list gets one starter ticket so the dashboard isn't blank.
- `POST /api/projects/import` — multipart form + a `.csv` file (max 2MB), parsed by `sprint_importer.parse_csv`. Required columns: `id`, `summary`; everything else (`status`, `assigneeName`, `assigneeEmail`, `storyPoints`, `blockers` `;`-separated, `acceptanceCriteria`, `priority`) is optional with sane defaults.

Seed projects (`projects.is_seed = true`) can't be deleted or have their ID collide with a new one — `create_project` slugifies the name and appends `-2`, `-3`, ... on collision. `DELETE /api/projects/{id}` refuses seed projects (400) and, for a user-created project, cascades to delete its `tickets`/`health_history`/`activity_log`/`slack_config` rows too.

**Real git webhook** — `POST /api/webhooks/git` with body `{project, event, ticketIds: [...], actor}`. If `GIT_WEBHOOK_SECRET` is set, the caller must send `X-Webhook-Signature: <hex hmac-sha256(secret, raw_body)>` or get a 401. This is intentionally a *different* code path from the "Simulate" buttons on `/kanban` (`kanban.simulate_event`, which picks the first eligible ticket for demo purposes) — the webhook (`kanban.apply_webhook_event`) transitions tickets by explicit ID and reports skipped/ineligible ones rather than erroring, since a single CI payload can reference tickets in different states.

**Scheduler** — `scheduler.py` is a thin APScheduler wrapper with no app-specific knowledge; `main.py`'s lifespan hands it `_run_all_projects_and_post` as the daily callback. It only runs when `SCHEDULER_ENABLED=true`; `GET /api/slack/overview` reports both the configured state and whether the scheduler is actually running (`scheduler.is_running()`).


---


## 11. Definition of done for any new feature


- [ ] Backend module is pure (no HTTP / Slack / Claude / SMTP) **or** clearly named as an external integration with a fallback.
- [ ] Unit test added for any new pure logic; `pytest tests/` is green.
- [ ] `.env.example` updated for any new env var; documented in [§10.1](#101-environment-variables).
- [ ] FastAPI route follows [§6 conventions](#6-api-contract-conventions): path param for resource routes, `{"error": ...}` for errors, no envelope.
- [ ] Component uses existing `components/common/*` primitives and Tailwind utilities only — no custom CSS, no dynamic class strings.
- [ ] Page registered in [App.jsx](frontend/src/App.jsx) and [Sidebar.jsx](frontend/src/components/layout/Sidebar.jsx) if it's a destination.
- [ ] `POST /api/run?project=<id>` completes end-to-end with `USE_MOCK_DATA=true` after the change.
- [ ] This file (SDLC.md) updated in the same PR if you added/removed a route, module, or persisted file.
