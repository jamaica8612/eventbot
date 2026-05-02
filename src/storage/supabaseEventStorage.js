import { createClient } from '@supabase/supabase-js';
import { getFallbackDecision } from '../../crawler/eventDecision/ruleDecision.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const effortLabels = {
  quick: '현장 딸각',
  home: '집에서 처리',
  hard: '복잡함',
};

export async function loadSupabaseEvents() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(80);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(toAppEvent);
}

export async function updateSupabaseEventState(eventId, patch) {
  if (!supabase) {
    return;
  }

  const rowPatch = toStateRowPatch(patch);
  if (Object.keys(rowPatch).length === 0) {
    return;
  }

  const { error } = await supabase.from('events').update(rowPatch).eq('id', eventId);
  if (error) {
    if (isMissingWinningColumnError(error)) {
      const legacyPatch = { ...rowPatch };
      delete legacyPatch.prize_title;
      delete legacyPatch.winning_memo;

      const { error: legacyError } = await supabase
        .from('events')
        .update(legacyPatch)
        .eq('id', eventId);

      if (!legacyError) {
        return;
      }
    }

    throw new Error(error.message);
  }
}

function isMissingWinningColumnError(error) {
  return (
    error?.code === 'PGRST204' ||
    /prize_title|winning_memo|schema cache|column/i.test(error?.message ?? '')
  );
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
    due: row.due_text,
    effort: row.effort,
    effortLabel: raw.effortLabel ?? effortLabels[row.effort],
    memo: row.memo,
  });

  return {
    id: row.id,
    title: row.title,
    originalTitle: raw.originalTitle ?? row.title,
    originalUrl: row.url,
    applyUrl: row.apply_url ?? raw.applyUrl ?? row.url,
    source: `${row.source_name} · ${row.platform}`,
    platform: row.platform,
    rank: row.rank,
    bookmarkCount: row.bookmark_count,
    due: decision.deadlineText,
    deadlineText: decision.deadlineText,
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

function toStateRowPatch(patch) {
  const rowPatch = {};

  if (patch.status) rowPatch.status = patch.status;
  if (patch.resultStatus) rowPatch.result_status = patch.resultStatus;
  if ('participatedAt' in patch) rowPatch.participated_at = patch.participatedAt;
  if ('resultCheckedAt' in patch) rowPatch.result_checked_at = patch.resultCheckedAt;
  if ('receiptStatus' in patch) rowPatch.receipt_status = patch.receiptStatus;
  if ('prizeTitle' in patch) rowPatch.prize_title = patch.prizeTitle;
  if ('winningMemo' in patch) rowPatch.winning_memo = patch.winningMemo;
  if ('prizeAmount' in patch) {
    const parsedAmount = Number.parseInt(String(patch.prizeAmount).replace(/[^\d]/g, ''), 10);
    rowPatch.prize_amount = Number.isFinite(parsedAmount) ? parsedAmount : null;
  }

  return rowPatch;
}
