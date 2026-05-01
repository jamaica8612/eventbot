import { createClient } from '@supabase/supabase-js';

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
    throw new Error(error.message);
  }
}

function toAppEvent(row) {
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};

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
    due: row.due_text,
    effort: row.effort,
    effortLabel: effortLabels[row.effort] ?? '현장 딸각',
    status: row.status,
    resultStatus: row.result_status,
    participatedAt: row.participated_at,
    resultCheckedAt: row.result_checked_at,
    prizeAmount: row.prize_amount ? String(row.prize_amount) : '',
    receiptStatus: row.receipt_status,
    memo: row.memo,
    url: row.url,
    crawledFrom: row.source_name,
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
  if ('prizeAmount' in patch) {
    const parsedAmount = Number.parseInt(String(patch.prizeAmount).replace(/[^\d]/g, ''), 10);
    rowPatch.prize_amount = Number.isFinite(parsedAmount) ? parsedAmount : null;
  }

  return rowPatch;
}
