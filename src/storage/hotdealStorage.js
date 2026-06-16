import { getAuthToken, requireUnlock } from './supabaseAuthStorage.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasHotdealConfig = Boolean(supabaseUrl && supabaseAnonKey);

const HOTDEAL_FUNCTION_URL = `${supabaseUrl}/functions/v1/hotdeal-data`;

export async function loadHotdeals(options = {}) {
  if (!hasHotdealConfig) return [];

  const token = await getAuthToken();
  if (!token) throw new Error('로그인이 필요합니다.');

  const url = new URL(HOTDEAL_FUNCTION_URL);
  url.searchParams.set('limit', String(options.limit ?? 120));
  if (options.source) url.searchParams.set('source', options.source);
  if (options.hideSoldOut) url.searchParams.set('hideSoldOut', '1');
  if (options.minRecommend) url.searchParams.set('minRecommend', String(options.minRecommend));

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) requireUnlock();
    throw new Error(payload.error || '핫딜을 불러오지 못했습니다.');
  }

  return Array.isArray(payload.hotdeals) ? payload.hotdeals.map(toHotdeal) : [];
}

function toHotdeal(row) {
  const price = row.price && typeof row.price === 'object' ? row.price : {};
  return {
    id: row.id,
    source: row.source || '',
    sourcePostId: row.source_post_id || '',
    title: row.title || '',
    priceText: typeof price.text === 'string' ? price.text : '',
    priceAmount: Number.isFinite(price.amount) ? price.amount : null,
    currency: price.currency || 'KRW',
    shop: row.shop || '',
    category: row.category || '',
    url: row.url || '',
    dealUrl: row.deal_url || '',
    thumbnail: row.thumbnail || '',
    recommendCount: Number.isFinite(row.recommend_count) ? row.recommend_count : 0,
    commentCount: Number.isFinite(row.comment_count) ? row.comment_count : 0,
    postedAt: row.posted_at || '',
    isSoldOut: Boolean(row.is_sold_out),
    isExpired: Boolean(row.is_expired),
    firstSeenAt: row.first_seen_at || '',
    lastSeenAt: row.last_seen_at || '',
    raw: row.raw || {},
  };
}
