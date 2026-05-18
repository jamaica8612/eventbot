-- v2 realtime 구독을 위해 events / user_event_states 테이블을
-- supabase_realtime publication에 추가한다.
-- 이미 등록되어 있으면 에러를 발생시키므로 do block으로 안전 처리.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    execute 'alter publication supabase_realtime add table public.events';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_event_states'
  ) then
    execute 'alter publication supabase_realtime add table public.user_event_states';
  end if;
end $$;
