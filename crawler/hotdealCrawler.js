import { spawn } from 'node:child_process';
import { canUseSupabase, upsertHotdeals } from './hotdealRepository.js';

async function main() {
  const payload = await crawlHotdeals();
  const deals = Array.isArray(payload.deals) ? payload.deals : [];
  const stats = Array.isArray(payload.stats) ? payload.stats : [];

  printQualitySummary(stats, deals.length);

  if (deals.length === 0) {
    throw new Error('Hotdeal crawler returned no deals.');
  }

  if (!canUseSupabase()) {
    console.log(`Supabase is not configured. Crawled ${deals.length} hotdeals without DB upsert.`);
    return;
  }

  const savedCount = await upsertHotdeals(deals);
  console.log(`Upserted ${savedCount} hotdeals to Supabase`);
}

function crawlHotdeals() {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'crawler.hotdeal.crawl'];
    if (process.env.HOTDEAL_LIMIT_PER_SOURCE) {
      args.push('--limit', process.env.HOTDEAL_LIMIT_PER_SOURCE);
    }

    const child = spawn(getPythonCommand(), args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (stderr.trim()) {
        console.warn(stderr.trim());
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python hotdeal crawler exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse hotdeal crawler output: ${error.message}`));
      }
    });
  });
}

function printQualitySummary(stats, total) {
  const parts = stats.map(
    (stat) => `${stat.source}/${stat.board} ${stat.count} fail ${stat.parseFailures}`,
  );
  console.log(`Hotdeal crawl quality: ${total} deals | ${parts.join(' | ')}`);
}

function getPythonCommand() {
  return process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
