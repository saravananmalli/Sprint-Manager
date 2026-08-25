-- Sprint Manager: initial Supabase schema
-- Replaces JSON-file persistence (projects_data.json, user_projects.json,
-- health_history.json, slack_config.json, .env-backed runtime settings).
-- Apply via Supabase SQL Editor (or `supabase db push`), then run
-- migrations/seed_supabase.py to load existing data.
--
-- Safe to re-run: drops anything from a previous partial run first.

drop function if exists create_project_with_tickets(
    text, text, text, text, text, date, date, integer, integer, text, jsonb, jsonb
);
drop table if exists activity_log;
drop table if exists runtime_settings;
drop table if exists slack_config;
drop table if exists health_history;
drop table if exists team_members;
drop table if exists tickets;
drop table if exists seed_tickets;
drop table if exists projects;

create table projects (
    id               text primary key,
    name             text not null,
    team_slug        text not null,
    channel          text not null,
    sprint_name      text not null,
    start_date       date not null,
    end_date         date not null,
    total_committed  integer not null default 0,
    points_done      integer not null default 0,
    prefix           text not null,
    jira_board_id    text,
    jira_sprint_id   text,
    is_seed          boolean not null default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

-- Read-only snapshot of each seed project's original tickets, populated once
-- by the seed migration script, never touched by app writes afterward.
-- reset_project() restores from this table (the old JSON file was immutable
-- "for free"; Postgres needs an explicit immutable copy instead).
create table seed_tickets (
    id          bigserial primary key,
    project_id  text not null references projects(id) on delete cascade,
    ticket_data jsonb not null
);
create unique index idx_seed_tickets_project_ticket
    on seed_tickets (project_id, (ticket_data->>'id'));

-- Composite PK: ticket "id" (e.g. "CHK-101") is only unique *within* a
-- project today, not globally, so it can't be a standalone PK.
create table tickets (
    project_id            text not null references projects(id) on delete cascade,
    id                    text not null,
    summary               text not null,
    status                text not null,
    assignee_name         text,
    assignee_email        text,
    story_points          integer not null default 0,
    priority              text,
    priority_label        text,
    last_updated          timestamptz not null,
    created_at            timestamptz not null,
    blockers              jsonb not null default '[]'::jsonb,
    acceptance_criteria   text default '',
    primary key (project_id, id)
);
create index idx_tickets_project_status on tickets (project_id, status);
create index idx_tickets_assignee_email on tickets (assignee_email);
-- riskTags is NEVER stored here — computed at read time by risk_engine.tag_tickets,
-- exactly as today. No column for it, by design.

-- Global, not per-project (get_team() returns one shared list).
create table team_members (
    email      text primary key,
    name       text not null,
    role       text not null default 'Engineer',
    created_at timestamptz not null default now()
);

create table health_history (
    id                bigserial primary key,
    project_id        text not null references projects(id) on delete cascade,
    date              date not null,
    score             integer,
    velocity_score    integer,
    blocker_score     integer,
    staleness_score   integer,
    completion_score  integer,
    sprint_status     text,
    tickets_at_risk   integer,
    run_id            uuid,
    created_at        timestamptz not null default now(),
    unique (project_id, date)
);
create index idx_health_history_project_date on health_history (project_id, date);

create table slack_config (
    project_id  text primary key references projects(id) on delete cascade,
    last_run_at timestamptz
);

-- Key/value rows (not fixed columns) so EDITABLE_KEYS can grow without a migration.
create table runtime_settings (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
);

-- Per-ticket status-change / event history, shown on the Kanban board.
-- NEW table — this data was never file-persisted before (in-memory only,
-- capped at 50, lost on restart). A real improvement, not a straight swap.
create table activity_log (
    id         bigserial primary key,
    project_id text not null references projects(id) on delete cascade,
    ticket_id  text,
    "from"     text,
    "to"       text,
    event      text not null,
    branch     text,
    actor      text not null,
    at         timestamptz not null default now()
);
create index idx_activity_log_project_at on activity_log (project_id, at desc);
-- Cap enforced at query time (ORDER BY at DESC LIMIT 50), not by deleting rows.

-- Atomic project + tickets + team-member creation (replaces the FileLock-based
-- atomicity guarantee create_project() relied on with JSON files). PostgREST
-- can't span a transaction across separate insert() calls, so this runs
-- server-side as a single function called via supabase-py's .rpc(...).
create or replace function create_project_with_tickets(
    p_id text,
    p_name text,
    p_team_slug text,
    p_channel text,
    p_sprint_name text,
    p_start_date date,
    p_end_date date,
    p_total_committed integer,
    p_points_done integer,
    p_prefix text,
    p_tickets jsonb,       -- array of ticket objects (frontend/API shape)
    p_team_members jsonb   -- array of {email, name, role} to upsert
) returns void as $$
begin
    insert into projects (
        id, name, team_slug, channel, sprint_name, start_date, end_date,
        total_committed, points_done, prefix, is_seed
    ) values (
        p_id, p_name, p_team_slug, p_channel, p_sprint_name, p_start_date, p_end_date,
        p_total_committed, p_points_done, p_prefix, false
    );

    insert into tickets (
        project_id, id, summary, status, assignee_name, assignee_email,
        story_points, priority, priority_label, last_updated, created_at,
        blockers, acceptance_criteria
    )
    select
        p_id,
        t->>'id',
        t->>'summary',
        t->>'status',
        t->'assignee'->>'name',
        t->'assignee'->>'email',
        coalesce((t->>'storyPoints')::integer, 0),
        t->>'priority',
        t->>'priorityLabel',
        coalesce((t->>'lastUpdated')::timestamptz, now()),
        coalesce((t->>'createdAt')::timestamptz, now()),
        coalesce(t->'blockers', '[]'::jsonb),
        coalesce(t->>'acceptanceCriteria', '')
    from jsonb_array_elements(p_tickets) as t;

    insert into team_members (email, name, role)
    select m->>'email', m->>'name', coalesce(m->>'role', 'Engineer')
    from jsonb_array_elements(p_team_members) as m
    on conflict (email) do nothing;
end;
$$ language plpgsql;
