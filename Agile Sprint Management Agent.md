# Agile Sprint Management Agent — Complete Application Specification

> **Purpose of this document**
> This is the single source of truth for the Agile Sprint Management Agent application. It contains every detail — product overview, user flows, information architecture, screen-level UI specs, design system, functional requirements, database schema, API contracts, security, responsive behavior, accessibility, error handling, notifications, analytics, and deployment — required to reproduce the application from scratch on any environment, on any machine, by any developer or AI tool, without requiring additional context.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Personas & User Roles](#2-personas--user-roles)
3. [User Flows](#3-user-flows)
4. [Information Architecture](#4-information-architecture)
5. [Screen-by-Screen UI Specifications](#5-screen-by-screen-ui-specifications)
6. [Wireframes & Layouts](#6-wireframes--layouts)
7. [Design System — Colors, Typography, Spacing](#7-design-system)
8. [Icons & Illustrations](#8-icons--illustrations)
9. [Text Content & Microcopy](#9-text-content--microcopy)
10. [Functional Requirements](#10-functional-requirements)
11. [Business Rules](#11-business-rules)
12. [Validation Rules](#12-validation-rules)
13. [Navigation & Interactions](#13-navigation--interactions)
14. [Database Schema & Data Model](#14-database-schema--data-model)
15. [API Specifications](#15-api-specifications)
16. [Claude API Integration](#16-claude-api-integration)
17. [Slack Integration](#17-slack-integration)
18. [Jira Integration](#18-jira-integration)
19. [Security Requirements](#19-security-requirements)
20. [Responsive Behavior](#20-responsive-behavior)
21. [Accessibility Guidelines](#21-accessibility-guidelines)
22. [Error Handling](#22-error-handling)
23. [Notifications & Alerts](#23-notifications--alerts)
24. [Analytics & Tracking](#24-analytics--tracking)
25. [Deployment Requirements](#25-deployment-requirements)
26. [Testing Strategy](#26-testing-strategy)
27. [Directory Structure](#27-directory-structure)
28. [Dependencies](#28-dependencies)
29. [Environment Variables](#29-environment-variables)
30. [Acceptance / Definition of Done](#30-acceptance--definition-of-done)

---

## 1. Product Overview

### 1.1 Product name
**Agile Sprint Management Agent** (internal codename: *Sprint Agent*).

### 1.2 One-liner
An autonomous agent that watches your sprint, spots at-risk tickets, nudges the right owners, posts a daily standup, and scores overall sprint health — from a single trigger.

### 1.3 Problem statement
Scrum Masters and delivery leads spend disproportionate time chasing status, spotting stale work, and preparing daily standups. Sprint slippage is usually detected too late, and owner nudges are inconsistent. Teams need an always-on assistant that surfaces risk early, drafts personalised nudges, and generates a factual daily digest.

### 1.4 Solution
A backend Python agent that:
1. Ingests sprint data from Jira (or a mock JSON snapshot).
2. Computes velocity and completion projections deterministically.
3. Tags each ticket with risk (STALE / STUCK / BLOCKED / UNASSIGNED / INCOMPLETE_AC).
4. Uses Claude Sonnet 4.6 to draft owner-specific nudges.
5. Uses Claude Sonnet 4.6 to draft a 4-section standup digest.
6. Computes a 0–100 sprint health score with trend detection.
7. Posts everything to Slack via an Incoming Webhook.

A React + Tailwind dashboard visualises the same data, exposes each step, and offers a "Run Agent" trigger button.

### 1.5 Primary value propositions
- **Early risk detection** — flags stale, stuck, and blocked items before standup.
- **Consistent, empathetic nudges** — one-click, Claude-authored owner messages.
- **Zero-effort standup** — factual 4-section digest generated on demand.
- **Objective health score** — 0–100 metric with trend over time.
- **One command** — everything triggered from a single button or CLI call.

### 1.6 Scope (Hackathon PoC — 1 day)
- **In scope:** All 6 pipeline steps, dashboard UI, mock data mode, Slack posting, health history persistence.
- **Out of scope:** User authentication, multi-team support, database persistence beyond flat JSON files, mobile-native apps, editing tickets in Jira, real-time updates via WebSocket, Kubernetes deploy.

### 1.7 Success metrics
- Full pipeline completes in < 30 seconds with 8-ticket sample.
- 100 % of at-risk tickets receive a nudge.
- Standup digest fits under 300 words.
- Health score matches formula within ±1 point when hand-computed.

---

## 2. Personas & User Roles

### 2.1 Primary persona — Scrum Master / Delivery Lead
- **Name:** Priya, 34, delivery lead at a 60-person product engineering org.
- **Goal:** Ship on-time, reduce interruptions from status-chasing.
- **Pain points:** Manual burndown updates, chasing 8 assignees for updates every morning.
- **Tech comfort:** High — comfortable with Jira, Slack, and dashboards.

### 2.2 Secondary persona — Engineering Manager
- **Goal:** Objective sprint health signal across multiple pods.
- **Frequency:** Checks dashboard 1–2× per day.

### 2.3 Tertiary persona — Team member
- **Interaction:** Receives Slack nudges, reads standup digest.
- **Never interacts** with the dashboard directly.

### 2.4 Roles (Hackathon PoC has no auth)
For the PoC there is a **single implicit role** — *Team lead / Scrum Master*. Everyone accessing the dashboard has full access to trigger runs and send nudges. Multi-role and auth are explicitly out of scope.

---

## 3. User Flows

### 3.1 Flow A — Daily standup preparation (happy path)
1. Priya opens the dashboard at 9:15 AM.
2. She clicks **Run Agent** in the header.
3. Header shows sequential status text: *"Fetching sprint data..."* → *"Analysing risks..."* → *"Generating nudges..."* → *"Writing standup summary..."* → *"Scoring health..."* → *"Done"*.
4. Dashboard refreshes with today's health score (e.g. 67), trend (*Declining*), sprint status badge (*At Risk*), and 4 stat cards.
5. Priya navigates to **Standup** page, reviews the 4-section digest.
6. She clicks **Send to Slack** — Slack post appears in `#pod3-standup`.
7. She navigates to **Nudges** page — 4 owner cards are visible.
8. She edits one nudge inline, clicks **Send** on each — nudges post to Slack.
9. She navigates to **Dashboard** to confirm updated status.

### 3.2 Flow B — Risk investigation
1. From Dashboard, Priya notices *Stale Tickets = 2*.
2. She navigates to **Sprint** board.
3. She filters risk tag `STALE`.
4. Two rows appear with amber `STALE` badges. She clicks each row → row expands to show details.
5. She copies the ticket ID and opens Jira in another tab (external, out of scope for our UI).

### 3.3 Flow C — Trend review (weekly retrospective)
1. Priya opens **History** page.
2. Line chart shows 14 days of health scores.
3. Trend label reads *Improving* — score climbed from 58 → 74.
4. Table below lists past runs with date, score, sprint status, and at-risk count.

### 3.4 Flow D — Manual CLI run (dev / debugging)
1. Developer runs `python agent_runner.py --mock` from terminal.
2. Console prints step-by-step logs.
3. Slack posts appear (if `SLACK_WEBHOOK_URL` set), else logs *"Slack disabled — no webhook configured"*.

### 3.5 Flow E — Failure recovery
1. Priya clicks **Run Agent**.
2. Claude API returns 429.
3. Agent retries once after 2s (per `tenacity` config).
4. Retry fails → agent logs error, skips nudge generation, continues with remaining steps.
5. Toast on frontend: *"Agent partially completed: nudge generation failed. See logs."* (red toast, dismissible).

### 3.6 Flow F — Empty sprint
1. Sprint has 0 tickets (unlikely but possible on day 1).
2. Dashboard shows 0/0 metrics, health score displayed as `—` (em dash), status badge `On Track` (green).
3. Standup and Nudges pages show empty-state illustrations with copy: *"Nothing to nudge yet — enjoy the calm."*

---

## 4. Information Architecture

### 4.1 Sitemap

```
/                        Dashboard (default landing)
/sprint                  Sprint board (full ticket table)
/standup                 Standup digest (4-section)
/nudges                  Owner nudges (cards)
/history                 Health score history
```

### 4.2 Global navigation (sidebar)
| Order | Label      | Route      | Icon (Heroicons name) |
|-------|------------|------------|-----------------------|
| 1     | Dashboard  | `/`        | `Squares2X2Icon`      |
| 2     | Sprint     | `/sprint`  | `RectangleStackIcon`  |
| 3     | Standup    | `/standup` | `ChatBubbleLeftRightIcon` |
| 4     | Nudges     | `/nudges`  | `BellAlertIcon`       |
| 5     | History    | `/history` | `ChartBarIcon`        |

### 4.3 Header (global)
- Left: current sprint name (e.g. *"Sprint 14 — Payments Pod"*) + date range (e.g. *"9 Jun – 20 Jun 2025"*).
- Center: (empty — reserved for search in a future release).
- Right: **Run Agent** primary button + last-run timestamp (*"Last run 09:14"*).

### 4.4 Content zones per page
Every page has:
- **Page title** (`<h1>`, 24 px, weight 600).
- **Optional subtitle** (14 px, gray-500).
- **Content grid** (12-column, 24 px gutter, max-width 1440 px).

---

## 5. Screen-by-Screen UI Specifications

### 5.1 Screen — Dashboard (`/`)

**Purpose:** At-a-glance sprint health and progress.

**Layout:**
```
Row 1  ┌──────────────────────┬────────────────────────────────┐
       │ HealthScoreCard      │ SprintStatusBadge + summary    │
       │ (span 4)             │ (span 8)                        │
Row 2  ├──────────────────────┴────────────────────────────────┤
       │ MetricsSummary — 4 stat cards, equal width (span 12)   │
Row 3  ├────────────────────────────────┬───────────────────────┤
       │ BurndownChart (span 8)         │ VelocityBar (span 4)  │
       └────────────────────────────────┴───────────────────────┘
```

**Component specs:**
- **HealthScoreCard**
  - Circular gauge, 200 × 200 px, thickness 16 px.
  - Center: large number (72 px, weight 700), suffix *"/ 100"* (14 px below in gray-500).
  - Trend badge below (Improving = green, Stable = gray, Declining = red) with arrow icon (`ArrowTrendingUpIcon` / `MinusIcon` / `ArrowTrendingDownIcon`).
  - Colors:
    - Score ≥ 80 → `stroke-emerald-500`, number `text-emerald-600`.
    - 60–79 → `stroke-amber-500`, number `text-amber-600`.
    - < 60 → `stroke-red-500`, number `text-red-600`.
- **SprintStatusBadge**
  - Large pill (padding 12 × 24 px, rounded-full, weight 600).
  - Colors: On Track = `bg-emerald-100 text-emerald-800`, At Risk = `bg-amber-100 text-amber-800`, Off Track = `bg-red-100 text-red-800`.
  - Followed by a 2-line explainer (e.g. *"Projected completion 22.7 / 24 points"*).
- **MetricsSummary** — 4 identical stat cards:
  1. Stories Done — value + delta from yesterday.
  2. Stale Tickets — value, red icon if > 0.
  3. Blocked — value, red icon if > 0.
  4. At Risk — count of tickets with any risk tag.
  - Card style: `bg-white rounded-2xl p-6 shadow-sm border border-gray-100`.
- **BurndownChart** — Recharts `<LineChart>`.
  - Two series: `ideal` (dashed gray) and `actual` (solid brand-600).
  - X-axis: day 1 … day 10.
  - Y-axis: points remaining.
  - Legend bottom-center.
  - Tooltip on hover.
- **VelocityBar**
  - Horizontal bar: `pointsDone / totalCommitted`.
  - Above the bar: text `"14 / 24 points"`.
  - Below the bar: percentage (58.3 %).
  - Fill color follows sprint status (green / amber / red).

**Behavior:**
- On mount, calls `GET /api/sprint` and `GET /api/health` in parallel.
- Shows skeleton loaders (`animate-pulse` gray blocks) while loading.
- Header **Run Agent** button triggers `POST /api/run` then refetches.

---

### 5.2 Screen — Sprint board (`/sprint`)

**Purpose:** Full ticket list with filters.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Filter bar: [Status ▼] [Risk tag multi-select ▼] [Search]  │
├────────────────────────────────────────────────────────────┤
│ TicketTable                                                │
│  ID | Summary | Assignee | Status | SP | Updated | Risks   │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

**Filter bar:**
- Status dropdown (`Todo / In Progress / In Review / Done / All`).
- Risk tag multi-select (chips: STALE, STUCK, BLOCKED, UNASSIGNED, INCOMPLETE_AC).
- Search input — filters by ticket ID or summary substring (case-insensitive).
- **Clear filters** ghost button — appears only when a filter is active.

**Table columns:**
| Column        | Width  | Content                                        |
|---------------|--------|------------------------------------------------|
| ID            | 100 px | e.g. `PROJ-101` — monospaced.                  |
| Summary       | flex   | Truncate at 60 chars with tooltip on hover.    |
| Assignee      | 160 px | Avatar (initials) + name.                      |
| Status        | 120 px | Colored pill.                                  |
| Story Points  | 60 px  | Right-aligned number.                          |
| Last Updated  | 140 px | Relative time (*"3 h ago"*), tooltip = ISO.    |
| Risks         | 220 px | Stack of `RiskBadge` pills, wraps.             |

**Row states:**
- Default: `hover:bg-gray-50`, cursor pointer.
- Click: expand inline detail panel (acceptance criteria, blocker ID list).
- Selected: `bg-brand-50` left-border 4 px `border-brand-500`.

**Empty state:** *"No tickets match your filters."* + illustration.

---

### 5.3 Screen — Standup (`/standup`)

**Purpose:** Display the 4-section standup digest generated by Claude.

**Layout:** Single card, `max-w-3xl`, `mx-auto`.

```
┌────────────────────────────────────────────────────────────┐
│ Standup — Sprint 14, Day 6 of 10          [Copy] [Send]   │
├────────────────────────────────────────────────────────────┤
│ ✅ Done yesterday                                          │
│   • PROJ-101 – User login flow (Priya S)                  │
│   • ...                                                    │
├────────────────────────────────────────────────────────────┤
│ 🔄 In Progress today                                       │
│   • ...                                                    │
├────────────────────────────────────────────────────────────┤
│ 🚧 Blocked                                                 │
│   • ...                                                    │
├────────────────────────────────────────────────────────────┤
│ ⚠️ At Risk                                                │
│   • ...                                                    │
└────────────────────────────────────────────────────────────┘
```

**Buttons:**
- **Copy** — copies plain-text digest to clipboard, shows *"Copied ✓"* for 1.5 s.
- **Send to Slack** — calls `POST /api/nudges/send` with `type=standup`, disables while sending, green toast on success.

**Behavior:**
- On mount, calls `GET /api/standup`.
- If no standup yet, shows empty state with **Run Agent** CTA.

---

### 5.4 Screen — Nudges (`/nudges`)

**Purpose:** Preview and send Claude-generated owner nudge messages.

**Layout:** Grid of nudge cards, 2 columns on desktop, 1 on mobile, 24 px gap.

**NudgeCard structure:**
```
┌────────────────────────────────────────────┐
│ [Avatar]  Priya Sundarrajan                │
│           2 tickets flagged STALE          │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ [editable textarea with nudge text]    │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│                       [Cancel] [Send ▶]    │
└────────────────────────────────────────────┘
```

**Card details:**
- Card: `bg-white rounded-2xl p-6 shadow-sm border border-gray-100`.
- Avatar: 40 px circle, gradient `from-brand-500 to-brand-700`, white initials.
- Textarea: `min-h-[120px]`, `border-gray-200 focus:border-brand-500`, `resize-y`.
- **Send** button: `bg-brand-600 text-white hover:bg-brand-700`, disabled while sending.
- **Cancel** ghost button: `text-gray-600 hover:bg-gray-50` — resets textarea to original message.

**Empty state:** *"All ticket owners are on track. Nothing to nudge."* + emerald checkmark illustration.

---

### 5.5 Screen — History (`/history`)

**Purpose:** Trend of daily health score over past 14 days.

**Layout:**
```
Row 1: Chart card (span 12)
Row 2: Trend label + Past runs table (span 12)
```

**Chart:** Recharts `<LineChart>` — X-axis dates, Y-axis 0–100. Reference lines at 60 and 80 (dashed).

**Table columns:**
| Date       | Score | Sprint Status | At Risk # | Trend |
|------------|-------|---------------|-----------|-------|
| 16 Jun     | 67    | At Risk       | 3         | ↓     |

Sort default: date descending.

---

## 6. Wireframes & Layouts

### 6.1 Global frame

```
┌────────────────────────────────────────────────────────────┐
│  Header  (Sprint name | Run Agent | last-run timestamp)    │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                 │
│ Sidebar  │  Page content                                   │
│ 240 px   │  max-width 1440 px, padding 32 px               │
│          │                                                 │
│  Nav     │                                                 │
│          │                                                 │
│          │                                                 │
└──────────┴─────────────────────────────────────────────────┘
Footer:  none  (PoC scope)
```

### 6.2 Grid system
- 12-column grid.
- Gutter: 24 px on desktop, 16 px on tablet, 12 px on mobile.
- Container max-width: 1440 px.
- Breakpoints (Tailwind default):
  - `sm` ≥ 640 px
  - `md` ≥ 768 px
  - `lg` ≥ 1024 px
  - `xl` ≥ 1280 px
  - `2xl` ≥ 1536 px

### 6.3 Sidebar responsive
- ≥ `lg` : 240 px wide, labels visible.
- `md` and below: 64 px, icon-only, labels appear on hover as tooltip.
- `< sm` : sidebar hides, replaced by top hamburger menu.

### 6.4 Card ASCII wireframe — HealthScoreCard

```
┌──────────────────────────────┐
│                              │
│         ╭────────╮           │
│        ╱          ╲          │
│       │     72     │         │
│       │   / 100    │         │
│        ╲          ╱          │
│         ╰────────╯           │
│                              │
│   [ ↑ Improving ]            │
│                              │
└──────────────────────────────┘
```

### 6.5 Card ASCII wireframe — MetricsSummary card

```
┌──────────────────────────────┐
│ 🗹  Stories Done             │
│                              │
│ 14                    +3 ↑   │
│                              │
│ Since last standup           │
└──────────────────────────────┘
```

---

## 7. Design System

### 7.1 Color palette

**Brand (primary):**
```
brand-50   #eef2ff
brand-100  #e0e7ff
brand-500  #6366f1   ← primary
brand-600  #4f46e5   ← primary hover / active
brand-700  #4338ca
```

**Semantic:**
| Purpose        | Tailwind          | Hex     |
|----------------|-------------------|---------|
| Success / green| `emerald-500`     | #10b981 |
| Success bg     | `emerald-100`     | #d1fae5 |
| Success text   | `emerald-800`     | #065f46 |
| Warning        | `amber-500`       | #f59e0b |
| Warning bg     | `amber-100`       | #fef3c7 |
| Warning text   | `amber-800`       | #92400e |
| Danger         | `red-500`         | #ef4444 |
| Danger bg      | `red-100`         | #fee2e2 |
| Danger text    | `red-800`         | #991b1b |
| Info / STUCK   | `orange-500`      | #f97316 |
| Purple / AC    | `purple-500`      | #a855f7 |

**Neutrals:**
```
gray-50   #f9fafb   page background
gray-100  #f3f4f6   card border
gray-200  #e5e7eb   dividers
gray-500  #6b7280   secondary text
gray-700  #374151   body text
gray-900  #111827   headings
white     #ffffff   surface
```

### 7.2 Typography

**Font family:**
- UI: `Inter`, fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Monospace (ticket IDs, JSON): `"JetBrains Mono", "Fira Code", monospace`.

**Scale:**
| Token   | Size (px) | Line height | Weight | Use                              |
|---------|-----------|-------------|--------|----------------------------------|
| xs      | 12        | 16          | 400    | Captions, badges                 |
| sm      | 14        | 20          | 400    | Secondary body                   |
| base    | 16        | 24          | 400    | Body                             |
| lg      | 18        | 28          | 500    | Card titles                      |
| xl      | 20        | 28          | 600    | Section headings                 |
| 2xl     | 24        | 32          | 600    | Page headings                    |
| 4xl     | 36        | 40          | 700    | Large stats                      |
| 6xl     | 60        | 60          | 700    | Health score number              |
| 7xl     | 72        | 72          | 700    | Big hero numbers                 |

### 7.3 Spacing
Tailwind default 4 px scale. Standard spacing tokens:
- Between siblings inside a card: `space-y-3` (12 px).
- Between cards / sections: `space-y-6` (24 px).
- Page padding: `p-8` (32 px) desktop, `p-4` (16 px) mobile.

### 7.4 Radii
- `rounded-md` = 6 px — inputs, small buttons.
- `rounded-lg` = 8 px — larger buttons.
- `rounded-xl` = 12 px — badges, chips.
- `rounded-2xl` = 16 px — cards.
- `rounded-full` — pills, avatars.

### 7.5 Shadows
- `shadow-sm` — cards.
- `shadow-md` — dropdowns, hovered cards.
- `shadow-lg` — modals, toasts.

### 7.6 Motion
- Standard transition: `transition-all duration-150 ease-out`.
- Toast enter/leave: `duration-200` slide + fade.
- Skeleton pulse: `animate-pulse`.
- No decorative animations — respect `prefers-reduced-motion`.

### 7.7 Focus state
All focusable elements: `focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`.

---

## 8. Icons & Illustrations

### 8.1 Icon set
**Heroicons v2** (`@heroicons/react/24/outline` and `/24/solid`).

**Used icons:**
| Purpose             | Icon (name)                    |
|---------------------|--------------------------------|
| Dashboard nav       | `Squares2X2Icon`               |
| Sprint nav          | `RectangleStackIcon`           |
| Standup nav         | `ChatBubbleLeftRightIcon`      |
| Nudges nav          | `BellAlertIcon`                |
| History nav         | `ChartBarIcon`                 |
| Trend up            | `ArrowTrendingUpIcon`          |
| Trend stable        | `MinusIcon`                    |
| Trend down          | `ArrowTrendingDownIcon`        |
| Run Agent           | `PlayIcon` (solid)             |
| Copy                | `ClipboardIcon`                |
| Send                | `PaperAirplaneIcon`            |
| Refresh             | `ArrowPathIcon`                |
| Filter              | `FunnelIcon`                   |
| Warning             | `ExclamationTriangleIcon`      |
| Success             | `CheckCircleIcon` (solid)      |
| Info                | `InformationCircleIcon`        |
| Danger              | `XCircleIcon` (solid)          |
| Close (toast/modal) | `XMarkIcon`                    |
| External link       | `ArrowTopRightOnSquareIcon`    |

Icon size default 20 × 20 px in buttons, 24 × 24 px in nav, 16 × 16 px in badges.

### 8.2 Illustrations
Optional (empty states). SVG, monochrome brand-500 stroke, ~120 × 120 px:
- **Empty nudges** — a checkmark with confetti.
- **Empty sprint** — an empty clipboard with a plus icon.
- **Empty history** — a small chart with a rising arrow.

If not designed, replace with an appropriate Heroicon (`CheckCircleIcon` at 96 px, gray-300).

### 8.3 Avatars
- 40 × 40 px circle, gradient `from-brand-500 to-brand-700`, white initials (2 letters, uppercase).
- Fallback for unassigned: gray-200 circle, `UserIcon` (gray-500).

---

## 9. Text Content & Microcopy

### 9.1 Global copy
- App name in header: **Sprint Agent**.
- Header subtitle format: `{sprintName} — {startDate} to {endDate}` (e.g. `Sprint 14 — 9 Jun to 20 Jun 2025`).
- Last run timestamp format: *"Last run 09:14"* (24-hour local time).
- Never-run state: *"Not yet run"*.

### 9.2 Buttons
| Context                   | Label                    |
|---------------------------|--------------------------|
| Header primary            | **Run Agent**            |
| Header — running state    | **Running…**             |
| Nudge card                | **Send** / **Cancel**    |
| Standup                   | **Copy** / **Send to Slack** |
| Table filter clear        | **Clear filters**        |

### 9.3 Empty states
| Page      | Copy                                                                 |
|-----------|----------------------------------------------------------------------|
| Nudges    | *"All ticket owners are on track. Nothing to nudge."*                |
| Sprint    | *"No tickets match your filters."*                                   |
| Standup   | *"No standup yet. Click Run Agent to generate one."*                 |
| History   | *"Not enough data yet — health scores show after your first run."*   |

### 9.4 Toasts
| Event                        | Text                                                | Variant |
|------------------------------|-----------------------------------------------------|---------|
| Run started                  | *"Agent run started"*                               | info    |
| Run success                  | *"Agent run complete"*                              | success |
| Run partial failure          | *"Agent partially completed. See logs."*            | warning |
| Run error                    | *"Agent run failed: {error}"*                       | error   |
| Nudge sent                   | *"Nudge sent to {name}"*                            | success |
| Slack disabled               | *"Slack webhook not configured — logged only"*      | info    |
| Copy standup                 | *"Copied to clipboard"*                             | success |

### 9.5 Confirmation dialogs
- **Send all nudges** — *"Send {n} nudges to Slack? This cannot be undone."* — buttons: **Cancel**, **Send all**.

### 9.6 Voice & tone
- **Factual**, not motivational — the digest is not a pep talk.
- **Collegial**, not passive-aggressive — no "still not done??" phrasing.
- **Concise** — under 300 words per digest.
- **Sentence case** for buttons and labels ("Run agent" acceptable but header uses title case "Run Agent" as brand pattern).

---

## 10. Functional Requirements

### 10.1 Backend functional requirements

**FR-B1** — Ingest sprint data.
- **Input:** Jira credentials + board ID + sprint ID (or `USE_MOCK_DATA=true`).
- **Output:** Structured sprint object with metadata + list of tickets.
- **Behavior:** If Jira 401 → fall back to mock and warn. If mock file missing → return HTTP 500 with clear error.

**FR-B2** — Compute velocity metrics.
- Pure deterministic math (no LLM).
- Formulas: see section 11.1.

**FR-B3** — Tag ticket risks.
- Apply 5 risk rules (STALE / STUCK / UNASSIGNED / BLOCKED / INCOMPLETE_AC) — see section 11.3.
- Each ticket may carry multiple risk tags.

**FR-B4** — Generate owner nudges.
- One Claude API call per unique assignee having ≥ 1 at-risk ticket.
- Uses Claude Sonnet 4.6, max 300 tokens per call.
- Retries once on failure (tenacity, wait 2 s).

**FR-B5** — Generate standup digest.
- Single Claude API call with full sprint JSON.
- Uses Claude Sonnet 4.6, max 600 tokens.
- Output must contain the four exact section headers.

**FR-B6** — Compute health score.
- Formula: see section 11.4.
- Persist daily score in `health_history.json`.
- Compute trend from last 3 entries.

**FR-B7** — Post to Slack.
- Sends 3 payload types: health-score block, standup text, nudge text (one per owner).
- If webhook missing → skip and log.

**FR-B8** — Expose REST API.
- Endpoints as specified in section 15.
- CORS enabled for `CORS_ORIGIN`.

**FR-B9** — CLI runner.
- `python agent_runner.py [--mock] [--step {risk|nudge|summary|health|all}]`.
- Default `--step all`.

**FR-B10** — Job status tracking.
- `POST /api/run` returns a `run_id` immediately, run happens in background.
- `GET /api/run/status?run_id=` returns current status + step + progress.

### 10.2 Frontend functional requirements

**FR-F1** — Dashboard renders health score, sprint status, metrics, burndown, velocity.
**FR-F2** — Sprint board supports filtering by status, risk tag, and search.
**FR-F3** — Standup page renders 4-section digest with copy and send.
**FR-F4** — Nudges page shows editable nudge per owner, per-card send action.
**FR-F5** — History page renders 14-day trend and past runs table.
**FR-F6** — Run Agent button triggers pipeline and polls status every 2 s.
**FR-F7** — All pages display skeleton loaders while data pending.
**FR-F8** — All pages support error state (retry button + error message).
**FR-F9** — Client stores no PII in localStorage — only UI preferences (e.g. sidebar collapsed).
**FR-F10** — Router: React Router v6 with the 5 routes specified. 404 route redirects to `/`.

---

## 11. Business Rules

### 11.1 Velocity math
```
velocity            = pointsDone / totalCommitted * 100
dailyBurnRate       = pointsDone / daysElapsed         (if daysElapsed > 0 else 0)
projectedCompletion = dailyBurnRate * daysRemaining + pointsDone
```
`daysElapsed` and `daysRemaining` are integer days derived from today's date vs sprint start/end. Weekends count as workdays for the PoC.

### 11.2 Sprint status thresholds
- **On Track** — `projectedCompletion ≥ 0.9 * totalCommitted`.
- **At Risk** — `0.7 * totalCommitted ≤ projectedCompletion < 0.9 * totalCommitted`.
- **Off Track** — `projectedCompletion < 0.7 * totalCommitted`.

### 11.3 Risk tag rules
| Tag             | Condition                                                                          |
|-----------------|------------------------------------------------------------------------------------|
| STALE           | `now - lastUpdated > STALE_THRESHOLD_HOURS` AND `status != Done`                   |
| STUCK           | `status == In Progress` AND `age > STUCK_THRESHOLD_PCT/100 * SPRINT_TOTAL_DAYS`    |
| UNASSIGNED      | `assignee == null` OR `assignee.name` is empty                                     |
| BLOCKED         | `blockers` is a non-empty list                                                     |
| INCOMPLETE_AC   | `acceptanceCriteria` is null OR length < 20 characters                             |

Thresholds are read at runtime from `.env` — never hardcoded.

### 11.4 Health score formula
```
velocityScore   = min(velocity, 100)
blockerScore    = 100 - (blockedTickets / totalTickets * 100)
stalenessScore  = 100 - (staleTickets   / totalTickets * 100)
completionScore = doneTickets / totalTickets * 100

healthScore = round(
  velocityScore   * 0.35 +
  blockerScore    * 0.25 +
  stalenessScore  * 0.25 +
  completionScore * 0.15
)
```
Score clamped to `[0, 100]`. If `totalTickets == 0` → score is `None` (frontend displays `—`).

### 11.5 Trend rules (based on last 3 entries in `health_history.json`)
- **Improving** — latest > previous + 5.
- **Declining** — latest < previous - 5.
- **Stable** — within ±5.
- Fewer than 2 entries → `Stable` by default.

### 11.6 Nudge deduplication
- Only one nudge per assignee per run — even if they have many at-risk tickets, all are batched into one Claude call.

### 11.7 Retry policy
- Every Claude call: retry once after 2 s (`tenacity` `stop_after_attempt(2)` + `wait_fixed(2)`).
- Slack webhook: no retry — log and continue.
- Jira: no retry on 401 (auth failure is not transient); retry once on 5xx.

### 11.8 History persistence
- One entry per calendar date. Multiple runs on the same date overwrite the same-date entry (last run wins).
- Retain last 30 entries; older entries pruned on write.

---

## 12. Validation Rules

### 12.1 Frontend input validation
| Field                             | Rule                                       | Error message                          |
|-----------------------------------|--------------------------------------------|----------------------------------------|
| Nudge textarea                    | Non-empty, ≤ 1500 chars                    | *"Message required (max 1500 chars)"*  |
| Sprint filter search              | ≤ 60 chars                                 | *"Search too long"*                    |
| Any request field                 | Sanitize HTML on render (use React default)| n/a                                    |

### 12.2 Backend input validation (Pydantic)
| Endpoint                | Field         | Rule                        |
|-------------------------|---------------|-----------------------------|
| `POST /api/nudges/send` | `type`        | Enum `standup | nudges | all` |
| `POST /api/nudges/send` | `messages[]`  | Each ≤ 4000 chars, ≤ 20 items |
| `GET /api/run/status`   | `run_id`      | UUIDv4                      |

Reject with HTTP 422 and JSON body `{"error": "...", "field": "..."}`.

### 12.3 Environment validation
On backend startup, validate presence of:
- `ANTHROPIC_API_KEY` — required unless `--dry-run` flag.
- Warn (not fail) if `SLACK_WEBHOOK_URL` missing.
- Warn (not fail) if Jira env vars missing when `USE_MOCK_DATA=false`.

---

## 13. Navigation & Interactions

### 13.1 Sidebar
- Active item styled: `bg-brand-50 text-brand-700 border-l-4 border-brand-500`.
- Inactive: `text-gray-600 hover:bg-gray-50`.
- Keyboard: `Tab` moves through items, `Enter` navigates.

### 13.2 Header — Run Agent button
- Idle: `bg-brand-600 text-white hover:bg-brand-700`.
- Running: disabled, spinner + label *"Running…"*.
- On click while idle → optimistic status text update to *"Starting…"*, then poll `/api/run/status` every 2 s.

### 13.3 Table row interactions
- Hover: `bg-gray-50`.
- Click: expand inline detail panel (chevron rotates 90°).
- Detail panel content: acceptance criteria (full text), blocker ID list (linked to Jira in future release, plain text now).

### 13.4 Toasts
- Position: top-right, offset 24 px from edges.
- Stack up to 3, oldest auto-dismisses after 5 s.
- Manual dismiss `XMarkIcon` button.

### 13.5 Modal (confirmation)
- Overlay: `bg-gray-900/50 backdrop-blur-sm`.
- Card: `max-w-md bg-white rounded-2xl p-6 shadow-lg`.
- Focus trap: focus moves to primary action on open; `Esc` closes; clicking overlay closes.

### 13.6 Keyboard shortcuts
- `g` then `d` → Dashboard.
- `g` then `s` → Sprint.
- `g` then `u` → Standup (u for stand-**u**p).
- `g` then `n` → Nudges.
- `g` then `h` → History.
- `r` → Run Agent (with confirm modal if already running).

Shortcut discoverability: `?` opens a shortcut cheatsheet modal.

---

## 14. Database Schema & Data Model

The PoC uses **flat JSON files** on disk — no RDBMS. Files live alongside `main.py` inside `backend/`.

### 14.1 `mock_data.json`

```json
{
  "sprintName": "Sprint 14",
  "startDate": "2025-06-09",
  "endDate": "2025-06-20",
  "totalCommitted": 24,
  "pointsDone": 14,
  "tickets": [
    {
      "id": "PROJ-101",
      "summary": "User login flow",
      "status": "Done",
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-14T10:22:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "User can log in with email and password. Errors shown for invalid input."
    }
  ]
}
```

The mock must contain **exactly 8 tickets** with the mix specified in CLAUDE.md § "Mock data spec".

### 14.2 `health_history.json`

```json
[
  {
    "date": "2025-06-14",
    "score": 72,
    "components": {
      "velocityScore": 60,
      "blockerScore": 87,
      "stalenessScore": 88,
      "completionScore": 55
    },
    "sprintStatus": "At Risk",
    "ticketsAtRisk": 3,
    "runId": "9b6f...uuid",
    "createdAt": "2025-06-14T09:15:00Z"
  }
]
```
- Array sorted by `date` ascending.
- Max 30 entries.
- File-level lock via `filelock` package to avoid concurrent write corruption.

### 14.3 In-memory state (per-process)

Backend keeps an in-memory dict `runs = { run_id: RunState }` where:
```python
class RunState(BaseModel):
    run_id: str
    status: Literal["running", "done", "error", "partial"]
    step: str         # human-readable current step
    progress: int     # 0-100
    error: Optional[str]
    startedAt: datetime
    finishedAt: Optional[datetime]
```
Cleared on process restart (acceptable for PoC).

### 14.4 Future / production schema (informational only)
If ported to Postgres, tables would be:
- `sprints (id, name, start_date, end_date, total_committed, created_at)`
- `tickets (id, sprint_id, summary, status, assignee_name, assignee_email, story_points, last_updated, blockers[], acceptance_criteria)`
- `risk_tags (ticket_id, tag, tagged_at)`
- `health_scores (id, sprint_id, date, score, components jsonb, run_id)`
- `runs (id, sprint_id, status, started_at, finished_at, error)`
- `nudges (id, run_id, assignee_email, message, sent_at)`

Not implemented in PoC.

---

## 15. API Specifications

Base URL: `http://localhost:8000`
Content-Type: `application/json`
CORS: allow `CORS_ORIGIN` (from env).

### 15.1 `GET /api/sprint`
**Purpose:** Return the current sprint snapshot with computed risk tags.

**Response 200:**
```json
{
  "sprintName": "Sprint 14",
  "startDate": "2025-06-09",
  "endDate": "2025-06-20",
  "daysElapsed": 6,
  "daysRemaining": 4,
  "totalCommitted": 24,
  "pointsDone": 14,
  "velocity": 58.3,
  "projectedCompletion": 22.7,
  "sprintStatus": "At Risk",
  "tickets": [
    {
      "id": "PROJ-101",
      "summary": "User login flow",
      "status": "Done",
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-14T10:22:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "User can log in with email...",
      "riskTags": []
    }
  ]
}
```

**Errors:**
- `500` — `{ "error": "Failed to load sprint data", "detail": "..." }`.

### 15.2 `GET /api/health`
**Purpose:** Today's health score, components, trend, and history.

**Response 200:**
```json
{
  "score": 67,
  "trend": "Declining",
  "components": {
    "velocityScore": 58,
    "blockerScore": 87,
    "stalenessScore": 75,
    "completionScore": 58
  },
  "history": [
    { "date": "2025-06-14", "score": 72 },
    { "date": "2025-06-15", "score": 69 },
    { "date": "2025-06-16", "score": 67 }
  ]
}
```

### 15.3 `GET /api/standup`
**Response 200:**
```json
{
  "generatedAt": "2025-06-16T09:14:12Z",
  "text": "*✅ Done yesterday*\n• PROJ-101 – User login flow (Priya S)\n\n*🔄 In Progress today*\n..."
}
```
If never generated: `404 { "error": "No standup available. Trigger a run first." }`.

### 15.4 `GET /api/nudges`
**Response 200:**
```json
{
  "generatedAt": "2025-06-16T09:14:12Z",
  "nudges": [
    {
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "ticketIds": ["PROJ-104", "PROJ-107"],
      "message": "PROJ-104 has been quiet for 26h and PROJ-107 has been in progress for 6 days. With 4 days left in the sprint, worth a quick refresh to keep them on track."
    }
  ]
}
```

### 15.5 `POST /api/run`
**Body:** none (empty).
**Response 202 (Accepted):**
```json
{ "run_id": "9b6f2c30-6c3a-11ee-b0a0-0242ac120002", "status": "running" }
```

### 15.6 `GET /api/run/status?run_id=<uuid>`
**Response 200:**
```json
{
  "run_id": "9b6f2c30-...",
  "status": "running",
  "step": "Generating nudges",
  "progress": 60,
  "error": null,
  "startedAt": "2025-06-16T09:14:00Z",
  "finishedAt": null
}
```
Status values: `running | done | error | partial`.

### 15.7 `POST /api/nudges/send`
**Body:**
```json
{ "type": "nudges | standup | all" }
```
**Response 200:**
```json
{ "posted": 4, "skipped": 0, "slackEnabled": true }
```

### 15.8 Error envelope (all endpoints)
```json
{
  "error": "Human-readable message",
  "detail": "Optional debug context",
  "code": "OPTIONAL_ENUM"
}
```

### 15.9 OpenAPI
`GET /docs` — FastAPI Swagger UI.
`GET /openapi.json` — machine-readable spec.

---

## 16. Claude API Integration

### 16.1 SDK & config
- Package: `anthropic>=0.25.0`.
- Model ID: `claude-sonnet-4-6` (hardcoded — do NOT use Opus or Haiku).
- Auth: `ANTHROPIC_API_KEY` env variable.
- Timeout: 20 s per call.

### 16.2 Nudge generation prompt (`nudge_generator.py`)
```
You are a friendly, supportive Scrum Master writing a Slack message.
Draft a nudge for {assignee_name} about the following stale ticket(s):

{ticket_list}

Rules:
- Max 3 sentences total
- Reference each ticket by ID and name
- Mention days since last update and sprint days remaining ({days_remaining} days left)
- Tone: collegial, not passive-aggressive
- No bullet points — write as natural Slack message
- Do not start with "Hey" or "Hi"
```

Parameters: `max_tokens=300`, `temperature=0.5`.

### 16.3 Standup summary prompt (`summary_generator.py`)
```
You are a Scrum Master writing the daily async standup summary for the team.
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
```
Parameters: `max_tokens=600`, `temperature=0.3`.

### 16.4 Retry & backoff
Wrap every Claude call with `tenacity`:
```python
@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
def call_claude(...): ...
```
On second failure, log the exception and return `None`. The caller must handle `None` gracefully (skip that section, continue pipeline).

### 16.5 Prompt caching (optional optimisation)
Not required in PoC. Leave off. If enabled later, cache the sprint JSON block since it's reused across nudge + standup calls.

---

## 17. Slack Integration

### 17.1 Setup
- Uses a **single Incoming Webhook** URL stored in `SLACK_WEBHOOK_URL`.
- No OAuth / Slack app scopes required for PoC.

### 17.2 Payload — Health score (Block Kit)
```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Sprint 14 — Health Score" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Score:* 67 / 100 (Declining)" },
        { "type": "mrkdwn", "text": "*Status:* At Risk" }
      ]
    }
  ]
}
```

### 17.3 Payload — Standup (plain text)
```json
{ "text": "*✅ Done yesterday*\n• PROJ-101 ...\n\n*🔄 In Progress today*\n..." }
```

### 17.4 Payload — Nudges (plain text, one POST per nudge)
```json
{ "text": "Priya — PROJ-104 has been quiet for 26h..." }
```

### 17.5 Error handling
- Non-200 response → log status + body, continue.
- Missing webhook env var → log *"Slack disabled — no webhook configured"* and return `slackEnabled: false`.

### 17.6 Rate limits
Slack webhook = 1 msg/sec/webhook. Insert `time.sleep(1)` between posts? No — CLAUDE.md forbids `time.sleep` for rate limiting. Use `tenacity`'s exponential backoff on 429 responses (retry twice with wait 1s and 2s).

---

## 18. Jira Integration

### 18.1 Endpoints used
- `GET https://{host}/rest/agile/1.0/board/{boardId}/sprint/{sprintId}/issue`
- `GET https://{host}/rest/api/3/issue/{issueKey}` (for detail — optional in PoC).

### 18.2 Auth
Basic auth: `email + API token` (base64-encoded). Header:
```
Authorization: Basic {base64(email:token)}
Accept: application/json
```

### 18.3 Field mapping
| Our field           | Jira source                                                       |
|---------------------|-------------------------------------------------------------------|
| id                  | `key`                                                             |
| summary             | `fields.summary`                                                  |
| status              | `fields.status.name` (normalized: To Do → Todo, etc.)             |
| assignee.name       | `fields.assignee.displayName`                                     |
| assignee.email      | `fields.assignee.emailAddress`                                    |
| storyPoints         | `fields.customfield_10016` (varies per Jira — configurable)        |
| lastUpdated         | `fields.updated`                                                  |
| createdAt           | `fields.created`                                                  |
| blockers            | `fields.issuelinks[]` filtered where `type.inward == "is blocked by"` |
| acceptanceCriteria  | `fields.customfield_XXXXX` (configurable via env)                 |

### 18.4 Fallback to mock
If `USE_MOCK_DATA=true` OR Jira returns 401 → load `mock_data.json`, log the fallback.

---

## 19. Security Requirements

### 19.1 Secrets management
- All secrets in `backend/.env` only. `.env` is `.gitignore`-d.
- Never log or print API keys.
- Never send secrets to the frontend.

### 19.2 CORS
- `CORS_ORIGIN` env var controls allowed origin (default `http://localhost:5173`).
- Methods allowed: `GET, POST, OPTIONS`.
- Credentials: `false` (no cookies used).

### 19.3 Input sanitization
- All API inputs validated with Pydantic — reject on 422.
- Frontend renders text with React (auto-escaped) — no `dangerouslySetInnerHTML`.

### 19.4 Rate limits (PoC)
- Global `POST /api/run` rate limit: 1 concurrent run per process. Second call returns `409 Conflict`.

### 19.5 Threat model (informational)
- **Not exposed to internet** in PoC — runs locally only.
- Production hardening would add: OAuth (Slack, Jira), audit log, RBAC, WAF, TLS termination via reverse proxy, secret rotation.

### 19.6 OWASP top 10 mitigations (as applicable to PoC)
| Risk                  | Mitigation                                       |
|-----------------------|--------------------------------------------------|
| Injection             | Pydantic + parameterised HTTP calls              |
| Broken auth           | N/A (no auth in PoC)                             |
| Sensitive data expo   | `.env` only, HTTPS in prod                       |
| XXE, insecure deser   | JSON only, no XML, `json.load` is safe           |
| Broken access control | N/A                                              |
| Security misconfig    | CORS restricted; secrets not in repo             |
| XSS                   | React auto-escaping; no inline HTML in nudges    |
| Insecure deps         | Pinned versions; `pip-audit` recommended         |
| Insufficient logging  | Structured logging via `logging` module          |
| SSRF                  | Only known-host outbound calls (Claude, Slack, Jira) |

---

## 20. Responsive Behavior

### 20.1 Breakpoints (Tailwind default)
| Breakpoint | Min width | Layout notes                                              |
|------------|-----------|-----------------------------------------------------------|
| default    | 0 px      | Single-column, sidebar hidden behind hamburger.           |
| sm         | 640 px    | Cards stack single-column. Sidebar becomes narrow icon-only. |
| md         | 768 px    | 2-column card grids. Sidebar 64 px, hover to expand.      |
| lg         | 1024 px   | Full 12-column layout, sidebar 240 px with labels.        |
| xl         | 1280 px   | Add extra whitespace, max content 1200 px.                |
| 2xl        | 1536 px   | Container caps at 1440 px, centered.                      |

### 20.2 Component responsiveness
- **HealthScoreCard** — 200 px on ≥ md, 160 px below.
- **MetricsSummary** — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- **BurndownChart** — `ResponsiveContainer` (Recharts), height fixed at 320 px, width fluid.
- **TicketTable** — horizontal scroll below `md`; sticky first column (ID).
- **NudgeCard grid** — `grid-cols-1 md:grid-cols-2`.

### 20.3 Touch targets
- Minimum tap area 44 × 44 px on touch devices.
- Buttons min-height 40 px, 48 px on `< md`.

---

## 21. Accessibility Guidelines

Target: **WCAG 2.1 AA**.

### 21.1 Color contrast
- Body text on white ≥ 4.5:1 (use `gray-700` = #374151).
- Small text on colored badges ≥ 4.5:1 — verified for all riskColors mappings.
- Focus ring `ring-brand-500` contrast ≥ 3:1 vs adjacent — passes.

### 21.2 Keyboard
- All interactive elements reachable via `Tab`.
- Skip-to-content link at top of page (visually hidden until focused).
- Modals trap focus; `Esc` closes.

### 21.3 Screen reader
- Every icon-only button has `aria-label` (e.g. `aria-label="Copy standup to clipboard"`).
- Toast container is `aria-live="polite"`.
- Loading spinners have `role="status"` + visually hidden text *"Loading"*.
- Table has `<caption>` (visually hidden) describing content.

### 21.4 Semantic HTML
- Landmarks: `<nav>`, `<main>`, `<header>`, `<aside>` where appropriate.
- Headings hierarchy: only one `<h1>` per page; sub-sections use `<h2>`, `<h3>`.
- Charts include a text alternative (aria-label describing the trend).

### 21.5 Motion
- Respect `prefers-reduced-motion` — disable non-essential transitions.

### 21.6 Forms
- Every textarea/input has a `<label>` (visible or `sr-only`).
- Error messages use `aria-describedby` on the offending field.

---

## 22. Error Handling

### 22.1 Frontend
- Axios interceptor: on 4xx/5xx, throw with `{ message, status, code }` — components show inline error state (retry button).
- Global error boundary at `<App>` root — displays fallback: *"Something went wrong. Try reloading."* + reload button.
- Network offline: banner at top *"You're offline. Some features may not work."* (via `navigator.onLine`).

### 22.2 Backend
- Pydantic validation errors → HTTP 422 with field name.
- Unhandled exceptions → HTTP 500 with error envelope; full stack trace only in `DEBUG` mode.
- `logger.exception(...)` on all caught exceptions.
- Pipeline steps individually try/except — one step failing does not stop the run.

### 22.3 Error mapping
| Cause                    | HTTP | Frontend behavior                              |
|--------------------------|------|------------------------------------------------|
| Jira 401                 | 200  | Falls back to mock, warn toast                  |
| Claude 429               | 500  | Toast: *"Rate limited — try again shortly"*     |
| Slack non-200            | 200  | Toast warning, run marked `partial`             |
| Missing sprint file      | 500  | Toast + retry button                            |
| Invalid nudge type       | 422  | Inline field error                              |

---

## 23. Notifications & Alerts

### 23.1 In-app toasts
- Library: custom lightweight (no external toast lib needed) OR `sonner` if preferred.
- Position: top-right, 24 px offset, `z-50`.
- Auto-dismiss 5 s (success/info), 8 s (warning), sticky until closed (error).
- Max 3 concurrent — oldest evicted.

### 23.2 Slack notifications
- **Health score** card — always posted on `POST /api/nudges/send { type: "all" }`.
- **Standup digest** — posted on `type: standup | all`.
- **Owner nudges** — posted on `type: nudges | all`, one message per owner.
- Order: health → standup → nudges.
- No user @-mentions in PoC (would need Slack user ID mapping).

### 23.3 Email (out of scope)
Not implemented in PoC. Interface stub only in `slack_sender.py` — no email.

---

## 24. Analytics & Tracking

### 24.1 Frontend
- **PoC:** none. Do not add third-party analytics.
- **Local dev only:** `console.info` on key events (run started, nudge sent).

### 24.2 Backend structured logs
Emit JSON logs (via Python `logging` + `json-log-formatter`):
```json
{
  "ts": "2025-06-16T09:14:00Z",
  "level": "INFO",
  "event": "run_started",
  "run_id": "9b6f...",
  "sprint": "Sprint 14"
}
```
Standard events: `run_started, step_started, step_completed, step_failed, run_completed, nudge_sent, slack_disabled, jira_fallback`.

### 24.3 Metrics (future / optional)
- `agent_runs_total` counter.
- `agent_run_duration_seconds` histogram.
- `claude_calls_total{status=success|failure}` counter.
- `slack_posts_total` counter.

Not required for hackathon.

---

## 25. Deployment Requirements

### 25.1 Local dev (default)
- Backend: `cd backend && uvicorn main:app --reload --port 8000`.
- Frontend: `cd frontend && npm install && npm run dev`.

### 25.2 Docker
`docker-compose.yml` (project root):
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host
```

### 25.3 Backend Dockerfile
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 25.4 Frontend Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

### 25.5 Production (informational)
- Frontend → static build (`npm run build`) served by Nginx / Cloudflare Pages.
- Backend → Docker image on Cloud Run / Fly.io / Fargate.
- Secrets → Secret Manager, not `.env` files.
- Persistence → Postgres for history (see section 14.4).

### 25.6 Cron (optional future feature)
Not required in PoC. A daily cron (e.g. GitHub Actions or Cloud Scheduler) at 09:00 local time would `curl -X POST http://backend/api/run`.

---

## 26. Testing Strategy

### 26.1 Backend unit tests (pytest)
- `tests/test_risk_engine.py` — every risk rule with edge cases (exact boundary, empty inputs, missing fields).
- `tests/test_health_score.py` — golden test cases with hand-computed expected scores.
- `tests/test_summary_generator.py` — mock Claude client, assert prompt format and section headers in output.

### 26.2 Integration tests
- Spin up FastAPI with `httpx.AsyncClient` in tests.
- `GET /api/sprint` returns 8 tickets from mock.
- `POST /api/run` returns 202 with run_id.

### 26.3 Frontend tests
- Not required for PoC.
- If added: Vitest + React Testing Library. Cover: routing, run agent flow, nudge card send.

### 26.4 Manual smoke test checklist
1. `docker-compose up --build` starts both.
2. Frontend loads at `localhost:5173`, no console errors.
3. Dashboard renders skeletons then live data.
4. Click Run Agent → status text cycles → toast success.
5. Standup page shows 4-section digest.
6. Nudges page shows ≥ 1 owner card.
7. Send nudge → Slack message appears (or Slack disabled toast).
8. History page shows chart with today's score.

---

## 27. Directory Structure

Exact layout — copy verbatim.

```
sprint-agent/
├── backend/
│   ├── main.py
│   ├── agent_runner.py
│   ├── jira_client.py
│   ├── risk_engine.py
│   ├── nudge_generator.py
│   ├── summary_generator.py
│   ├── health_score.py
│   ├── slack_sender.py
│   ├── mock_data.json
│   ├── health_history.json
│   ├── .env                  # gitignored
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│       ├── __init__.py
│       ├── test_risk_engine.py
│       ├── test_health_score.py
│       └── test_summary_generator.py
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Header.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── HealthScoreCard.jsx
│   │   │   │   ├── SprintStatusBadge.jsx
│   │   │   │   ├── BurndownChart.jsx
│   │   │   │   ├── VelocityBar.jsx
│   │   │   │   └── MetricsSummary.jsx
│   │   │   ├── tickets/
│   │   │   │   ├── TicketTable.jsx
│   │   │   │   ├── TicketRow.jsx
│   │   │   │   └── RiskBadge.jsx
│   │   │   ├── standup/
│   │   │   │   ├── StandupPanel.jsx
│   │   │   │   └── CopyButton.jsx
│   │   │   ├── nudges/
│   │   │   │   ├── NudgeList.jsx
│   │   │   │   └── NudgeCard.jsx
│   │   │   └── common/
│   │   │       ├── Toast.jsx
│   │   │       ├── Skeleton.jsx
│   │   │       └── Spinner.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── SprintBoard.jsx
│   │   │   ├── StandupPage.jsx
│   │   │   ├── NudgesPage.jsx
│   │   │   └── HistoryPage.jsx
│   │   ├── hooks/
│   │   │   ├── useSprint.js
│   │   │   ├── useAgentRun.js
│   │   │   └── useToast.js
│   │   └── utils/
│   │       ├── formatters.js
│   │       └── riskColors.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
├── CLAUDE.md
├── SDLC.md
└── APPLICATION_SPEC.md      # this file
```

---

## 28. Dependencies

### 28.1 Backend — `requirements.txt`
```
anthropic>=0.25.0
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
requests>=2.31.0
python-dotenv>=1.0.0
tenacity>=8.2.0
pytest>=7.4.0
httpx>=0.27.0
filelock>=3.13.0
```
Optional (if adding structured logging): `python-json-logger`.

### 28.2 Frontend — `package.json` (key parts)
```json
{
  "name": "sprint-agent-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "axios": "^1.7.0",
    "recharts": "^2.12.0",
    "@heroicons/react": "^2.1.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### 28.3 Tailwind config
`frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      }
    }
  },
  plugins: []
}
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`frontend/postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

---

## 29. Environment Variables

### 29.1 Backend — `backend/.env.example`
```env
ANTHROPIC_API_KEY=sk-ant-xxxx
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=xxxx
JIRA_BOARD_ID=42
JIRA_SPRINT_ID=current
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
USE_MOCK_DATA=true
STALE_THRESHOLD_HOURS=24
STUCK_THRESHOLD_PCT=50
SPRINT_TOTAL_DAYS=10
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=INFO
```

### 29.2 Frontend — `frontend/.env.example`
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 29.3 `.gitignore` entries
```
# Python
__pycache__/
*.pyc
.venv/
backend/.env
backend/health_history.json

# Node
node_modules/
dist/
frontend/.env
frontend/.env.local

# Editor
.vscode/
.idea/
.DS_Store
```

---

## 30. Acceptance / Definition of Done

### 30.1 Backend acceptance
- [ ] `uvicorn main:app` starts with no errors.
- [ ] `GET /api/sprint` returns 8 tickets with correctly computed risk tags.
- [ ] `GET /api/health` returns score, trend, and 3+ entries of history after 3 runs.
- [ ] `POST /api/run` returns 202 with a UUID.
- [ ] `GET /api/run/status` reports progress incrementing 0 → 100.
- [ ] `GET /api/standup` returns text containing all 4 section headers.
- [ ] `GET /api/nudges` returns one nudge per unique at-risk assignee.
- [ ] `POST /api/nudges/send` returns `posted` count; logs "Slack disabled" if webhook empty.
- [ ] All 3 test files pass `pytest`.

### 30.2 Frontend acceptance
- [ ] `npm run dev` starts with no console errors.
- [ ] Dashboard renders: health gauge, status badge, 4 stat cards, burndown, velocity.
- [ ] Sprint board shows 8 rows with correct risk badges and filters work.
- [ ] Standup page shows 4 clearly labelled sections + copy + send buttons.
- [ ] Nudges page shows one card per at-risk owner; textarea is editable; send works.
- [ ] History page shows chart + past runs table + trend label.
- [ ] Run Agent button cycles status and shows completion toast.
- [ ] Mobile viewport (390 px) renders without horizontal scroll (except ticket table).
- [ ] Keyboard-only navigation reaches every interactive element.

### 30.3 Cross-cutting acceptance
- [ ] No API keys committed to git.
- [ ] `docker-compose up --build` succeeds; both services healthy.
- [ ] Full pipeline finishes in < 30 s with mock data.
- [ ] Claude API model used is `claude-sonnet-4-6` (grep-verified in source).
- [ ] No custom CSS files — Tailwind utilities only.
- [ ] No use of `time.sleep` for rate limiting.
- [ ] No dynamic Tailwind class concatenation.
- [ ] Risk thresholds read from `.env`, not hardcoded.

---

## Appendix A — Sample mock sprint (`mock_data.json`)

```json
{
  "sprintName": "Sprint 14",
  "startDate": "2025-06-09",
  "endDate": "2025-06-20",
  "totalCommitted": 24,
  "pointsDone": 14,
  "tickets": [
    {
      "id": "PROJ-101",
      "summary": "User login flow",
      "status": "Done",
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-14T10:22:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "User can log in with email and password. Errors are shown for invalid credentials."
    },
    {
      "id": "PROJ-102",
      "summary": "Password reset email",
      "status": "Done",
      "assignee": { "name": "Arjun R", "email": "arjun@co.com" },
      "storyPoints": 2,
      "lastUpdated": "2025-06-13T15:00:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "User receives reset email within 60s. Link expires in 15 minutes."
    },
    {
      "id": "PROJ-103",
      "summary": "Profile page basic layout",
      "status": "Done",
      "assignee": { "name": "Meera K", "email": "meera@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-12T11:10:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "Profile shows avatar, name, email, and edit button."
    },
    {
      "id": "PROJ-104",
      "summary": "Two-factor authentication",
      "status": "In Progress",
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "storyPoints": 5,
      "lastUpdated": "2025-06-14T09:00:00Z",
      "createdAt": "2025-06-10T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "User can enable TOTP; login prompts for 6-digit code."
    },
    {
      "id": "PROJ-105",
      "summary": "Rate limiting on auth endpoints",
      "status": "In Progress",
      "assignee": { "name": "Arjun R", "email": "arjun@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-15T18:30:00Z",
      "createdAt": "2025-06-10T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "Login rate-limited to 5/min per IP."
    },
    {
      "id": "PROJ-106",
      "summary": "Session invalidation on password change",
      "status": "In Progress",
      "assignee": { "name": "Meera K", "email": "meera@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-13T12:00:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": ""
    },
    {
      "id": "PROJ-107",
      "summary": "Audit log for auth events",
      "status": "In Progress",
      "assignee": { "name": "Priya S", "email": "priya@co.com" },
      "storyPoints": 3,
      "lastUpdated": "2025-06-13T09:15:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": [],
      "acceptanceCriteria": "All login/logout/2FA events recorded with timestamp, IP, user agent."
    },
    {
      "id": "PROJ-108",
      "summary": "SSO integration with Okta",
      "status": "Todo",
      "assignee": { "name": "Karthik V", "email": "karthik@co.com" },
      "storyPoints": 5,
      "lastUpdated": "2025-06-11T11:00:00Z",
      "createdAt": "2025-06-09T09:00:00Z",
      "blockers": ["PROJ-104"],
      "acceptanceCriteria": "Users authenticate via Okta SAML; role mapping preserved."
    }
  ]
}
```

Expected risk tag assignment (with `STALE_THRESHOLD_HOURS=24`, `STUCK_THRESHOLD_PCT=50`, `SPRINT_TOTAL_DAYS=10`, today = 2025-06-16):
- PROJ-101, PROJ-102, PROJ-103 → no tags (Done).
- PROJ-104 → `STUCK` (In Progress > 5 days).
- PROJ-105 → no tags (updated < 24h).
- PROJ-106 → `STALE` + `INCOMPLETE_AC` (empty AC, updated 3 days ago).
- PROJ-107 → `STALE` + `STUCK`.
- PROJ-108 → `BLOCKED`.

---

## Appendix B — Sample Slack messages

**Health card:**
> **Sprint 14 — Health Score**
> *Score:* 67 / 100 (Declining)
> *Status:* At Risk

**Standup:**
> *✅ Done yesterday*
> • PROJ-101 – User login flow (Priya S)
> • PROJ-102 – Password reset email (Arjun R)
> • PROJ-103 – Profile page basic layout (Meera K)
>
> *🔄 In Progress today*
> • PROJ-104 – Two-factor authentication (Priya S)
> • PROJ-105 – Rate limiting on auth endpoints (Arjun R)
> • PROJ-106 – Session invalidation on password change (Meera K)
> • PROJ-107 – Audit log for auth events (Priya S)
>
> *🚧 Blocked*
> • PROJ-108 – SSO integration with Okta (Karthik V) — blocked by PROJ-104
>
> *⚠️ At Risk*
> • PROJ-106 – acceptance criteria missing (Meera K)
> • PROJ-107 – no updates for 3 days (Priya S)

**Nudge (Priya):**
> PROJ-104 has been in progress for 6 days and PROJ-107 hasn't been updated in 3 days. With 4 days left in the sprint, a quick status refresh on both would help us hit our commitment. Anything blocking that I can help unblock?

---

## Appendix C — Sample React component reference

### `HealthScoreCard.jsx` (structural reference — do not treat as final code)
```jsx
import { ArrowTrendingUpIcon, MinusIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid'

const TREND_ICON = {
  Improving: ArrowTrendingUpIcon,
  Stable:    MinusIcon,
  Declining: ArrowTrendingDownIcon,
}

const scoreColor = (s) =>
  s >= 80 ? 'text-emerald-600 stroke-emerald-500'
  : s >= 60 ? 'text-amber-600 stroke-amber-500'
  : 'text-red-600 stroke-red-500'

export default function HealthScoreCard({ score, trend }) {
  const TrendIcon = TREND_ICON[trend] ?? MinusIcon
  const color     = scoreColor(score)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
      <div className="relative w-52 h-52">
        {/* SVG gauge omitted for brevity — draws circular progress */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${color}`}>
          <span className="text-7xl font-bold">{score ?? '—'}</span>
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50">
        <TrendIcon className="w-4 h-4" />
        <span className="text-sm font-medium">{trend}</span>
      </div>
    </div>
  )
}
```

---

## Appendix D — Definitions & glossary

| Term            | Definition                                                                 |
|-----------------|----------------------------------------------------------------------------|
| Sprint          | Fixed-duration development cycle (default 10 days).                        |
| Velocity        | pointsDone / totalCommitted × 100.                                         |
| Burn-down       | Chart of remaining points per day, ideal vs actual.                        |
| Nudge           | Owner-specific Slack message reminding them of at-risk tickets.            |
| Health score    | Composite 0–100 metric summarizing sprint state.                           |
| Standup         | Daily brief of Done / In Progress / Blocked / At Risk items.               |
| At-risk ticket  | Ticket with ≥ 1 risk tag.                                                  |
| Run             | One end-to-end execution of the 6-step pipeline.                           |

---

*End of document.*


