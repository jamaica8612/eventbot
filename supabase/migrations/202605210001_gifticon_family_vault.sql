create table if not exists public.gifticon_families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족 기프티콘',
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gifticon_family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.gifticon_families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gifticon_family_members_role_check check (role in ('owner', 'member')),
  constraint gifticon_family_members_family_email_unique unique (family_id, email)
);

create table if not exists public.gifticons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.gifticon_families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  expires_at date,
  memo text not null default '',
  barcode_value text not null default '',
  image_path text not null,
  status text not null default 'active',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gifticons_status_check check (status in ('active', 'used'))
);

create table if not exists public.gifticon_activity_logs (
  id uuid primary key default gen_random_uuid(),
  gifticon_id uuid not null references public.gifticons(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  previous_status text,
  next_status text,
  created_at timestamptz not null default now()
);

create index if not exists gifticon_family_members_user_idx on public.gifticon_family_members (user_id);
create index if not exists gifticon_family_members_email_idx on public.gifticon_family_members (email);
create index if not exists gifticons_family_status_idx on public.gifticons (family_id, status, expires_at);
create index if not exists gifticons_deleted_idx on public.gifticons (deleted_at);
create index if not exists gifticon_activity_logs_gifticon_idx on public.gifticon_activity_logs (gifticon_id, created_at desc);

drop trigger if exists set_gifticon_families_updated_at on public.gifticon_families;
create trigger set_gifticon_families_updated_at
before update on public.gifticon_families
for each row
execute function public.set_updated_at();

drop trigger if exists set_gifticon_family_members_updated_at on public.gifticon_family_members;
create trigger set_gifticon_family_members_updated_at
before update on public.gifticon_family_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_gifticons_updated_at on public.gifticons;
create trigger set_gifticons_updated_at
before update on public.gifticons
for each row
execute function public.set_updated_at();

alter table public.gifticon_families enable row level security;
alter table public.gifticon_family_members enable row level security;
alter table public.gifticons enable row level security;
alter table public.gifticon_activity_logs enable row level security;

revoke select, insert, update, delete on public.gifticon_families from anon;
revoke select, insert, update, delete on public.gifticon_family_members from anon;
revoke select, insert, update, delete on public.gifticons from anon;
revoke select, insert, update, delete on public.gifticon_activity_logs from anon;

insert into storage.buckets (id, name, public)
values ('gifticon-images', 'gifticon-images', false)
on conflict (id) do nothing;
