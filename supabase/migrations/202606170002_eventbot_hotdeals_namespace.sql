do $$
begin
  if to_regclass('public.hotdeals') is not null
     and to_regclass('public.eventbot_hotdeals') is null then
    alter table public.hotdeals rename to eventbot_hotdeals;
  end if;
end
$$;

create table if not exists public.eventbot_hotdeals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_post_id text not null,
  title text not null,
  price jsonb not null default '{}'::jsonb,
  shop text not null default '',
  category text not null default '',
  url text not null,
  deal_url text not null default '',
  thumbnail text not null default '',
  recommend_count integer not null default 0,
  comment_count integer not null default 0,
  posted_at timestamptz,
  is_sold_out boolean not null default false,
  is_expired boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  unique (source, source_post_id)
);

drop index if exists public.hotdeals_last_seen_at_idx;
drop index if exists public.hotdeals_posted_at_idx;
drop index if exists public.hotdeals_source_idx;
drop index if exists public.hotdeals_shop_idx;
drop index if exists public.hotdeals_category_idx;
drop index if exists public.hotdeals_active_idx;

create index if not exists eventbot_hotdeals_last_seen_at_idx on public.eventbot_hotdeals (last_seen_at desc);
create index if not exists eventbot_hotdeals_posted_at_idx on public.eventbot_hotdeals (posted_at desc);
create index if not exists eventbot_hotdeals_source_idx on public.eventbot_hotdeals (source);
create index if not exists eventbot_hotdeals_shop_idx on public.eventbot_hotdeals (shop);
create index if not exists eventbot_hotdeals_category_idx on public.eventbot_hotdeals (category);
create index if not exists eventbot_hotdeals_active_idx on public.eventbot_hotdeals (is_expired, is_sold_out);

alter table public.eventbot_hotdeals enable row level security;
alter table public.eventbot_hotdeals force row level security;

revoke all privileges on table public.eventbot_hotdeals from anon;
revoke all privileges on table public.eventbot_hotdeals from authenticated;
