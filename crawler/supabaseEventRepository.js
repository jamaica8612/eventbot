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
    if (isMissingDecisionColumnError(error)) {
      const legacyRows = events.map(toLegacyEventRow);
      const { error: legacyError } = await supabase
        .from('events')
        .upsert(legacyRows, { onConflict: 'source_site,source_event_id' });

      if (legacyError) {
        throw new Error(`Supabase legacy upsert failed: ${legacyError.message}`);
      }

      return legacyRows.length;
    }

    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return rows.length;
}

function isMissingDecisionColumnError(error) {
  return (
    error?.code === 'PGRST204' ||
    /click_score|action_type|estimated_seconds|decision_reason|prize_text|deadline_text|result_announcement|schema cache|column/i.test(
      error?.message ?? '',
    )
  );
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
    click_score: event.clickScore,
    action_type: event.actionType,
    estimated_seconds: event.estimatedSeconds,
    decision_reason: event.decisionReason ?? '',
    prize_text: event.prizeText ?? '',
    deadline_text: event.deadlineText ?? event.due ?? '상세 확인 필요',
    result_announcement_date: event.resultAnnouncementDate || null,
    result_announcement_text: event.resultAnnouncementText ?? '',
    effort: event.effort ?? 'quick',
    memo: event.memo ?? '',
    raw: event,
    last_seen_at: new Date().toISOString(),
  };
}

function toLegacyEventRow(event) {
  const {
    click_score,
    action_type,
    estimated_seconds,
    decision_reason,
    prize_text,
    deadline_text,
    result_announcement_date,
    result_announcement_text,
    ...row
  } = toEventRow(event);

  return row;
}
