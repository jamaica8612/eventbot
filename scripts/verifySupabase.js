import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

loadLocalEnv();

const requiredKeys = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.error(`Missing Supabase env keys: ${missingKeys.join(', ')}`);
  process.exitCode = 1;
} else {
  await verifySupabase();
}

async function verifySupabase() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { count, error: countError } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Supabase count failed: ${countError.message}`);
  }

  const { data, error: recentError } = await supabase
    .from('events')
    .select('source_site, source_event_id, title, status, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(3);

  if (recentError) {
    throw new Error(`Supabase recent query failed: ${recentError.message}`);
  }

  const latestSeenAt = data?.[0]?.last_seen_at ?? 'none';
  await saveCrawlStatus(supabase, {
    status: 'success',
    checkedAt: new Date().toISOString(),
    totalEvents: count ?? 0,
    latestSeenAt,
    recentEvents: (data ?? []).map((event) => ({
      sourceSite: event.source_site,
      sourceEventId: event.source_event_id,
      title: event.title,
      status: event.status,
      lastSeenAt: event.last_seen_at,
    })),
  });

  console.log(`Supabase connection OK. events=${count ?? 0}, latest_last_seen_at=${latestSeenAt}`);
  for (const event of data ?? []) {
    console.log(
      [
        event.source_site,
        event.source_event_id,
        event.status,
        event.last_seen_at,
        event.title,
      ].join(' | '),
    );
  }
}

async function saveCrawlStatus(supabase, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'crawl_status', value }, { onConflict: 'key' });

  if (error) {
    throw new Error(`Supabase crawl status save failed: ${error.message}`);
  }
}

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    if (!existsSync(fileName)) {
      continue;
    }

    for (const line of readFileSync(fileName, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}
