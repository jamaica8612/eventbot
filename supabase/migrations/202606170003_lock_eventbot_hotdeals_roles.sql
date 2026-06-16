alter table public.eventbot_hotdeals enable row level security;
alter table public.eventbot_hotdeals force row level security;

revoke all privileges on table public.eventbot_hotdeals from anon;
revoke all privileges on table public.eventbot_hotdeals from authenticated;
