create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_event_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id),
  constraint user_event_states_status_check check (status in ('ready', 'later', 'done', 'skipped')),
  constraint user_event_states_result_status_check check (result_status in ('unknown', 'won', 'lost')),
  constraint user_event_states_receipt_status_check check (receipt_status in ('unclaimed', 'requested', 'received'))
);

create index if not exists user_event_states_event_idx on public.user_event_states (event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_event_states_updated_at on public.user_event_states;

create trigger set_user_event_states_updated_at
before update on public.user_event_states
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_event_states enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read own event states" on public.user_event_states;
drop policy if exists "Users can write own event states" on public.user_event_states;

revoke select, insert, update, delete on public.profiles from anon;
revoke select, insert, update, delete on public.user_event_states from anon;
