import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

loadLocalEnv();

const requiredKeys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  console.error(`Missing Supabase env keys: ${missingKeys.join(', ')}`);
  process.exitCode = 1;
} else {
  await saveFailureStatus();
}

async function saveFailureStatus() {
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

  const previous = await loadPreviousStatus(supabase);
  const failedAt = new Date().toISOString();
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const runUrl = repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null;
  const failureMessage =
    process.env.CRAWL_FAILURE_MESSAGE ||
    process.env.CRAWL_FAILURE_STAGE ||
    'GitHub Actions crawler failed.';

  const value = {
    ...(previous ?? {}),
    status: 'failure',
    checkedAt: failedAt,
    failedAt,
    failureMessage,
    runUrl,
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'crawl_status', value }, { onConflict: 'key' });

  if (error) {
    throw new Error(`Supabase crawl failure status save failed: ${error.message}`);
  }

  console.log(`Saved crawl failure status at ${failedAt}`);
}

async function loadPreviousStatus(supabase) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'crawl_status')
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase crawl status load failed: ${error.message}`);
  }

  return data?.value && typeof data.value === 'object' ? data.value : null;
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
