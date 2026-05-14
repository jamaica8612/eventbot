import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { analyzeAnnouncementByRules } from '../crawler/eventDecision/announcementDecision.js';

loadLocalEnv();

const requiredKeys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.error(`Missing Supabase env keys: ${missingKeys.join(', ')}`);
  process.exitCode = 1;
} else {
  await backfillAnnouncementDates();
}

async function backfillAnnouncementDates() {
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

  const { data, error } = await supabase
    .from('events')
    .select('id,source_event_id,title,result_announcement_date,result_announcement_text,raw')
    .order('last_seen_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Event load failed: ${error.message}`);
  }

  let updated = 0;
  for (const row of data ?? []) {
    const result = analyzeAnnouncementByRules(buildAnnouncementInput(row));
    if (!result.resultAnnouncementDate) continue;
    if (row.result_announcement_date === result.resultAnnouncementDate) continue;

    const { error: updateError } = await supabase
      .from('events')
      .update({
        result_announcement_date: result.resultAnnouncementDate,
        result_announcement_text: result.resultAnnouncementText,
        raw: {
          ...(row.raw ?? {}),
          resultAnnouncementDate: result.resultAnnouncementDate,
          resultAnnouncementText: result.resultAnnouncementText,
        },
      })
      .eq('id', row.id);

    if (updateError) {
      throw new Error(`Event ${row.source_event_id} update failed: ${updateError.message}`);
    }
    updated += 1;
    console.log(`${row.source_event_id} ${result.resultAnnouncementDate} ${row.title}`);
  }

  console.log(`Backfilled announcement dates: ${updated}`);
}

function buildAnnouncementInput(row) {
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
  const detailMetaLines = Array.isArray(raw.detailMetaLines) ? raw.detailMetaLines : [];
  const originalLines = Array.isArray(raw.originalLines) ? raw.originalLines : [];
  const bodyLines = Array.isArray(raw.bodyLines) ? raw.bodyLines : [];
  const originalText = [
    raw.originalText,
    raw.bodyText,
    raw.contentText,
    raw.pageText,
    detailMetaLines.join('\n'),
    originalLines.join('\n'),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...raw,
    resultAnnouncementDate: '',
    resultAnnouncementText: '',
    originalText,
    originalLines: [...detailMetaLines, ...originalLines],
    bodyLines,
  };
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
