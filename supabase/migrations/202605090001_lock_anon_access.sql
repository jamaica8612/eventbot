create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read events" on public.events;
drop policy if exists "Public can update events" on public.events;
drop policy if exists "Anon can update event state" on public.events;
drop policy if exists "Public can read app settings" on public.app_settings;
drop policy if exists "Anon can insert app settings" on public.app_settings;
drop policy if exists "Anon can update app settings" on public.app_settings;

revoke select, insert, update, delete on public.events from anon;
revoke select, insert, update, delete on public.app_settings from anon;
