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

  const rows = await buildRowsPreservingBodies(supabase, events);
  const { error } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'source_site,source_event_id' });

  if (error) {
    if (isMissingDecisionColumnError(error)) {
      const legacyRows = events.map((event) => toLegacyEventRow(event, error));
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
    /click_score|action_type|estimated_seconds|decision_reason|prize_text|deadline_text|deadline_date|result_announcement|schema cache|column/i.test(
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
    deadline_date: event.deadlineDate || null,
    result_announcement_date: event.resultAnnouncementDate || null,
    result_announcement_text: event.resultAnnouncementText ?? '',
    effort: event.effort ?? 'quick',
    memo: event.memo ?? '',
    raw: event,
    last_seen_at: new Date().toISOString(),
  };
}

function toLegacyEventRow(event, error) {
  const row = toEventRow(event);
  const missingColumns = inferMissingColumns(error);
  for (const column of missingColumns) {
    delete row[column];
  }
  return row;
}

async function buildRowsPreservingBodies(supabase, events) {
  const sourceIds = events.map((event) => event.id.replace(/^suto-/, ''));
  const { data, error } = await supabase
    .from('events')
    .select('source_event_id,raw')
    .eq('source_site', 'suto')
    .in('source_event_id', sourceIds);

  if (error || !Array.isArray(data)) {
    return events.map(toEventRow);
  }

  const existingById = new Map(data.map((row) => [row.source_event_id, row.raw]));
  return events.map((event) => {
    const sourceEventId = event.id.replace(/^suto-/, '');
    const existingRaw = existingById.get(sourceEventId);
    return toEventRow(mergeExistingBody(event, existingRaw));
  });
}

function mergeExistingBody(event, existingRaw) {
  if (hasBody(event) || !hasBody(existingRaw)) {
    return event;
  }

  return {
    ...event,
    originalText: existingRaw.originalText ?? event.originalText,
    originalLines: existingRaw.originalLines ?? event.originalLines,
    detailMetaLines: existingRaw.detailMetaLines ?? event.detailMetaLines,
    applyTargetUrl: event.applyTargetUrl || existingRaw.applyTargetUrl || '',
    externalLinks: event.externalLinks?.length ? event.externalLinks : existingRaw.externalLinks ?? [],
    youtubeTranscripts: event.youtubeTranscripts?.length
      ? event.youtubeTranscripts
      : existingRaw.youtubeTranscripts ?? [],
    detailCrawlStatus: event.detailCrawlStatus === 'ok' ? event.detailCrawlStatus : 'preserved',
    detailCrawlMessage:
      event.detailCrawlStatus === 'ok'
        ? event.detailCrawlMessage
        : 'Preserved previously crawled body because the latest crawl returned an empty body.',
  };
}

function hasBody(value) {
  return (
    Array.isArray(value?.originalLines) && value.originalLines.length > 0
  ) || Boolean(typeof value?.originalText === 'string' && value.originalText.trim());
}

function inferMissingColumns(error) {
  const message = error?.message ?? '';
  const optionalColumns = [
    'apply_url',
    'click_score',
    'action_type',
    'estimated_seconds',
    'decision_reason',
    'prize_text',
    'deadline_text',
    'deadline_date',
    'result_announcement_date',
    'result_announcement_text',
    'prize_title',
    'prize_amount',
    'receipt_status',
    'winning_memo',
  ];
  const mentionedColumns = optionalColumns.filter((column) => message.includes(column));

  if (mentionedColumns.length > 0) {
    return mentionedColumns;
  }

  return ['deadline_date'];
}
