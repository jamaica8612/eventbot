import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function canUseSupabase() {
  loadLocalEnv();
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

export async function upsertEvents(events) {
  loadLocalEnv();

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const rows = events.map(toEventRow);
  const { error } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'source_site,source_event_id' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return rows.length;
}

function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL;
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), fileName);
    if (!existsSync(envPath)) {
      continue;
    }

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function toEventRow(event) {
  const sourceEventId = event.id.replace(/^suto-/, '');

  return {
    source_site: 'suto',
    source_name: '슈퍼투데이',
    source_event_id: sourceEventId,
    title: event.originalTitle ?? event.title,
    url: event.originalUrl ?? event.url,
    apply_url: event.applyUrl ?? null,
    platform: event.platform ?? '이벤트',
    rank: event.rank,
    bookmark_count: event.bookmarkCount,
    due_text: event.due ?? '상세 확인 필요',
    effort: event.effort ?? 'quick',
    memo: event.memo ?? '',
    raw: event,
    last_seen_at: new Date().toISOString(),
  };
}
