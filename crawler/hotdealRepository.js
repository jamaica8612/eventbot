import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function canUseSupabase() {
  loadLocalEnv();
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

export async function upsertHotdeals(deals) {
  loadLocalEnv();

  const supabase = createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const rows = deals.map(toHotdealRow);
  const { error } = await supabase
    .from('hotdeals')
    .upsert(rows, { onConflict: 'source,source_post_id' });

  if (error) {
    throw new Error(`Supabase hotdeal upsert failed: ${error.message}`);
  }

  return rows.length;
}

function toHotdealRow(deal) {
  const now = new Date().toISOString();
  return {
    source: deal.source,
    source_post_id: deal.sourcePostId,
    title: deal.title,
    price: {
      text: deal.priceText || '',
      amount: Number.isFinite(deal.priceAmount) ? deal.priceAmount : null,
      currency: deal.currency || 'KRW',
    },
    shop: deal.shop || '',
    category: deal.category || '',
    url: deal.url,
    deal_url: deal.dealUrl || '',
    thumbnail: deal.thumbnail || '',
    recommend_count: Number.isFinite(deal.recommendCount) ? deal.recommendCount : 0,
    comment_count: Number.isFinite(deal.commentCount) ? deal.commentCount : 0,
    posted_at: deal.postedAt || null,
    is_sold_out: Boolean(deal.isSoldOut),
    is_expired: Boolean(deal.isExpired),
    last_seen_at: now,
    raw: deal,
  };
}

function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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
