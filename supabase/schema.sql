create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  source_site text not null,
  source_name text not null,
  source_event_id text not null,
  title text not null,
  url text not null,
  apply_url text,
  platform text not null default 'event',
  rank integer,
  bookmark_count integer,
  due_text text not null default 'check_detail',
  click_score integer,
  action_type text,
  estimated_seconds integer,
  decision_reason text,
  prize_text text,
  deadline_text text,
  effort text not null default 'quick',
  status text not null default 'ready',
  result_status text not null default 'unknown',
  participated_at timestamptz,
  result_checked_at timestamptz,
  prize_title text,
  prize_amount integer,
  receipt_status text not null default 'unclaimed',
  winning_memo text,
  memo text not null default '',
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_source_unique unique (source_site, source_event_id),
  constraint events_click_score_check check (click_score is null or (click_score >= 0 and click_score <= 100)),
  constraint events_action_type_check check (action_type is null or action_type in ('now', 'home', 'skip')),
  constraint events_effort_check check (effort in ('quick', 'home', 'hard')),
  constraint events_status_check check (status in ('ready', 'later', 'done', 'skipped')),
  constraint events_result_status_check check (result_status in ('unknown', 'won', 'lost')),
  constraint events_receipt_status_check check (receipt_status in ('unclaimed', 'requested', 'received'))
);

create index if not exists events_status_idx on public.events (status);
create index if not exists events_result_status_idx on public.events (result_status);
create index if not exists events_last_seen_at_idx on public.events (last_seen_at desc);
create index if not exists events_effort_idx on public.events (effort);

alter table public.events add column if not exists apply_url text;
alter table public.events add column if not exists prize_title text;
alter table public.events add column if not exists prize_amount integer;
alter table public.events add column if not exists receipt_status text not null default 'unclaimed';
alter table public.events add column if not exists winning_memo text;
alter table public.events add column if not exists click_score integer;
alter table public.events add column if not exists action_type text;
alter table public.events add column if not exists estimated_seconds integer;
alter table public.events add column if not exists decision_reason text;
alter table public.events add column if not exists prize_text text;
alter table public.events add column if not exists deadline_text text;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;

create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

alter table public.events enable row level security;

drop policy if exists "Public can read events" on public.events;
drop policy if exists "Public can update events" on public.events;

create policy "Public can read events"
on public.events
for select
using (true);

create policy "Public can update events"
on public.events
for update
using (true)
with check (true);
