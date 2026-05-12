import { getFallbackDecision } from '../../crawler/eventDecision/ruleDecision.js';
import { getAuthToken, requireUnlock } from './passcodeAuthStorage.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const DATA_FUNCTION_URL = `${supabaseUrl}/functions/v1/eventbot-data`;

const effortLabels = {
  quick: '현장 딸각',
  home: '집에서 처리',
  hard: '복잡함',
};

export async function loadSupabaseEvents() {
  if (!hasSupabaseConfig) {
    return [];
  }

  const payload = await callDataFunction('GET', 'events');
  const rows = payload.events;
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(toAppEvent);
}
export async function updateSupabaseEventState(eventId, patch) {
  if (!hasSupabaseConfig) {
    return;
  }

  await callDataFunction('POST', '', {
    action: 'updateEventState',
    eventId,
    patch,
  });
}

export async function loadSupabaseFilterSettings() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const payload = await callDataFunction('GET', 'filterSettings');
  return payload.value ?? null;
}

export async function saveSupabaseFilterSettings(settings) {
  if (!hasSupabaseConfig) {
    return;
  }

  await callDataFunction('POST', '', {
    action: 'saveFilterSettings',
    settings,
  });
}

export async function loadSupabaseCrawlerStatus() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const payload = await callDataFunction('GET', 'crawlStatus');
  return payload.value ?? null;
}

async function callDataFunction(method, resource, body) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('잠금 해제가 필요합니다.');
  }

  const url = new URL(DATA_FUNCTION_URL);
  if (resource) {
    url.searchParams.set('resource', resource);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      'x-eventbot-token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      requireUnlock();
    }
    throw new Error(payload.error || 'DB 요청에 실패했습니다.');
  }
  return payload;
}

function toAppEvent(row) {
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
  const decision = getFallbackDecision({
    ...raw,
    clickScore: row.click_score ?? raw.clickScore,
    actionType: row.action_type ?? raw.actionType,
    estimatedSeconds: row.estimated_seconds ?? raw.estimatedSeconds,
    decisionReason: row.decision_reason ?? raw.decisionReason ?? row.memo,
    prizeText: row.prize_text ?? raw.prizeText,
    deadlineText: row.deadline_text ?? raw.deadlineText ?? row.due_text,
    deadlineDate: row.deadline_date ?? raw.deadlineDate,
    due: row.due_text,
    effort: row.effort,
    effortLabel: raw.effortLabel ?? effortLabels[row.effort],
    memo: row.memo,
  });

  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    title: row.title,
    originalTitle: raw.originalTitle ?? row.title,
    originalUrl: row.url,
    applyUrl: row.apply_url ?? raw.applyUrl ?? row.url,
    lastSeenAt: row.last_seen_at,
    source: `${row.source_name} · ${row.platform}`,
    platform: row.platform,
    rank: row.rank,
    bookmarkCount: row.bookmark_count,
    totalWinnerCount: raw.totalWinnerCount ?? '',
    due: decision.deadlineText,
    deadlineText: decision.deadlineText,
    deadlineDate: row.deadline_date ?? raw.deadlineDate ?? decision.deadlineDate ?? '',
    clickScore: decision.clickScore,
    actionType: decision.actionType,
    estimatedSeconds: decision.estimatedSeconds,
    decisionReason: decision.decisionReason,
    prizeText: decision.prizeText,
    effort: decision.effort,
    effortLabel: decision.effortLabel,
    status: row.status,
    resultStatus: row.result_status,
    participatedAt: row.participated_at,
    resultCheckedAt: row.result_checked_at,
    resultAnnouncementDate:
      row.result_announcement_date ?? raw.resultAnnouncementDate ?? '',
    resultAnnouncementText:
      row.result_announcement_text ?? raw.resultAnnouncementText ?? '',
    prizeTitle: row.prize_title ?? raw.prizeTitle ?? decision.prizeText ?? '',
    prizeAmount: row.prize_amount == null ? '' : String(row.prize_amount),
    receiptStatus: row.receipt_status ?? 'unclaimed',
    winningMemo: row.winning_memo ?? raw.winningMemo ?? '',
    memo: row.memo,
    url: row.url,
    crawledFrom: row.source_name,
    raw,
    originalLines: raw.originalLines,
    originalText: raw.originalText,
  };
}
