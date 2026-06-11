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
  deadline_date date,
  effort text not null default 'quick',
  status text not null default 'ready',
  result_status text not null default 'unknown',
  participated_at timestamptz,
  result_checked_at timestamptz,
  result_announcement_date date,
  result_announcement_text text,
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

-- 기존 테이블이 있는 환경(이전 스키마 버전)에서도 안전하도록
-- 누락 가능 컬럼은 add column if not exists로 보강한다.
-- 새 환경에서는 위 create table이 이미 모두 만들어 두었으므로 no-op이다.
alter table public.events add column if not exists apply_url text;
alter table public.events add column if not exists click_score integer;
alter table public.events add column if not exists action_type text;
alter table public.events add column if not exists estimated_seconds integer;
alter table public.events add column if not exists decision_reason text;
alter table public.events add column if not exists prize_text text;
alter table public.events add column if not exists deadline_text text;
alter table public.events add column if not exists deadline_date date;
alter table public.events add column if not exists result_announcement_date date;
alter table public.events add column if not exists result_announcement_text text;
alter table public.events add column if not exists prize_title text;
alter table public.events add column if not exists prize_amount integer;
alter table public.events add column if not exists receipt_status text not null default 'unclaimed';
alter table public.events add column if not exists winning_memo text;

create index if not exists events_status_idx on public.events (status);
create index if not exists events_result_status_idx on public.events (result_status);
create index if not exists events_last_seen_at_idx on public.events (last_seen_at desc);
create index if not exists events_effort_idx on public.events (effort);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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

drop trigger if exists set_app_settings_updated_at on public.app_settings;

create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read events" on public.events;
drop policy if exists "Public can update events" on public.events;
drop policy if exists "Anon can update event state" on public.events;
drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Anon can insert app settings" on public.app_settings;
drop policy if exists "Anon can update app settings" on public.app_settings;

-- 단일 사용자 도구이므로 anon 키로 읽기/상태 업데이트는 허용한다.
-- 단, anon이 갱신할 수 있는 컬럼을 사용자 상태 컬럼으로만 제한해서
-- 크롤러가 채우는 메타데이터(title, url, source 등)를 보호한다.
-- The public app no longer reads/writes tables directly with the anon key.
-- Data access goes through Edge Functions after passcode token verification.

-- 컬럼 단위 권한: anon이 update 가능한 컬럼만 화이트리스트로 부여한다.
revoke select, insert, update, delete on public.events from anon;
revoke select, insert, update, delete on public.app_settings from anon;
