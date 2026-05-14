alter table public.user_event_states
  add column if not exists youtube_context jsonb not null default '{}'::jsonb,
  add column if not exists youtube_context_saved_at timestamptz;
