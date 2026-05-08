import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

loadLocalEnv();

const hasSupabase =
  Boolean(process.env.VITE_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const steps = hasSupabase
  ? [
      ['목록 크롤링 + Supabase upsert', ['crawler/sutoCrawler.js']],
      ['본문 보강', ['crawler/sutoBrowserCrawler.js']],
      ['Supabase 저장 확인', ['scripts/verifySupabase.js']],
    ]
  : [['목록 크롤링 + JSON fallback 저장', ['crawler/sutoCrawler.js']]];

if (!hasSupabase) {
  console.log('Supabase env is not configured. Skipping body crawl and DB verification.');
}

for (const [label, args] of steps) {
  console.log(`\n== ${label} ==`);
  await runNode(args);
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUTO_BODY_LIMIT: process.env.SUTO_BODY_LIMIT ?? '80',
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`node ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), fileName);
    if (!existsSync(envPath)) {
      continue;
    }

    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}
