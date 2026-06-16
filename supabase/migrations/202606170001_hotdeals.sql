create table if not exists public.hotdeals (
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

create index if not exists hotdeals_last_seen_at_idx on public.hotdeals (last_seen_at desc);
create index if not exists hotdeals_posted_at_idx on public.hotdeals (posted_at desc);
create index if not exists hotdeals_source_idx on public.hotdeals (source);
create index if not exists hotdeals_shop_idx on public.hotdeals (shop);
create index if not exists hotdeals_category_idx on public.hotdeals (category);
create index if not exists hotdeals_active_idx on public.hotdeals (is_expired, is_sold_out);

alter table public.hotdeals enable row level security;

revoke select, insert, update, delete on public.hotdeals from anon;
