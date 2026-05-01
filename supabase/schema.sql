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
  effort text not null default 'quick',
  status text not null default 'ready',
  result_status text not null default 'unknown',
  participated_at timestamptz,
  result_checked_at timestamptz,
  prize_amount integer,
  receipt_status text not null default 'unclaimed',
  memo text not null default '',
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_source_unique unique (source_site, source_event_id),
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
alter table public.events add column if not exists prize_amount integer;
alter table public.events add column if not exists receipt_status text not null default 'unclaimed';

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
