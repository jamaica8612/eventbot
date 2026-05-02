import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const DEBUG_PORT = Number(process.env.SUTO_BROWSER_PORT ?? 9223);
const PROFILE_DIR = path.join(process.cwd(), '.crawler-chrome-profile');
const BODY_LIMIT = Number(process.env.SUTO_BODY_LIMIT ?? 12);
const NAVIGATION_WAIT_MS = Number(process.env.SUTO_BODY_WAIT_MS ?? 7000);

async function main() {
  loadLocalEnv();

  const supabase = createClient(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const events = await loadBodyTargets(supabase);
  if (events.length === 0) {
    console.log('No events need body crawling.');
    return;
  }

  await mkdir(PROFILE_DIR, { recursive: true });
  const chrome = await launchChrome();

  try {
    await waitForChrome();

    for (const event of events) {
      const result = await crawlBody(event.url);
      await saveBodyResult(supabase, event, result);
      console.log(
        `${result.status.padEnd(9)} ${String(result.lines.length).padStart(2)} lines · ${event.title}`,
      );
    }
  } finally {
    chrome.kill();
  }
}

async function loadBodyTargets(supabase) {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,url,raw,last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  return data
    .filter((event) => {
      const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
      return !Array.isArray(raw.originalLines) || raw.originalLines.length === 0;
    })
    .slice(0, BODY_LIMIT);
}

async function saveBodyResult(supabase, event, result) {
  const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const nextRaw = {
    ...raw,
    originalText: result.text,
    originalLines: result.lines,
    detailCrawlStatus: result.status,
    detailCrawlMessage: result.message,
    detailCrawledAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('events')
    .update({ raw: nextRaw })
    .eq('id', event.id);

  if (error) {
    throw new Error(`Failed to save body for ${event.title}: ${error.message}`);
  }
}

async function crawlBody(url) {
  const page = await openDebugPage(url);
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Page.navigate', { url });
    await sleep(NAVIGATION_WAIT_MS);

    const { result } = await client.send('Runtime.evaluate', {
      expression: `(${extractPageBody.toString()})()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const value = result?.value ?? {};
    const lines = normalizeLines(value.lines ?? []);
    const isBlocked = value.blocked || lines.some((line) => /Just a moment|Cloudflare/i.test(line));

    return {
      status: isBlocked ? 'blocked' : lines.length > 0 ? 'ok' : 'empty',
      message: value.message ?? '',
      text: isBlocked ? '' : lines.join('\n'),
      lines: isBlocked ? [] : lines,
    };
  } finally {
    await client.close();
    await closeDebugPage(page.id);
  }
}

function extractPageBody() {
  const blocked =
    document.title.includes('Just a moment') ||
    document.body.innerText.includes('Just a moment') ||
    document.body.innerText.includes('Cloudflare');

  const selectors = [
    '#bo_v_con',
    '.bo_v_con',
    '.view-content',
    '.view_content',
    '.event_view',
    '.contents',
    'article',
    'main',
  ];
  const node = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  const text = (node ?? document.body).innerText ?? '';

  return {
    blocked,
    message: blocked ? 'Cloudflare challenge or protection page detected.' : '',
    lines: text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  };
}

function normalizeLines(lines) {
  return lines
    .map((line) => String(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^(목록|이전글|다음글|댓글|로그인|회원가입)$/.test(line))
    .filter((line, index, allLines) => allLines.indexOf(line) === index)
    .slice(0, 32);
}

async function openDebugPage(url) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  });

  if (!response.ok) {
    throw new Error(`Failed to open Chrome tab: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function closeDebugPage(id) {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${id}`).catch(() => {});
}

async function launchChrome() {
  const executable = CHROME_PATHS.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome or Edge executable was not found.');
  }

  return spawn(
    executable,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      'about:blank',
    ],
    {
      detached: false,
      stdio: 'ignore',
    },
  );
}

async function waitForChrome() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }

    await sleep(300);
  }

  throw new Error('Chrome debug endpoint did not start in time.');
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  open() {
    this.socket = new WebSocket(this.webSocketUrl);
    this.socket.addEventListener('message', (event) => this.handleMessage(event));

    return new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;

    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (!message.id || !this.pending.has(message.id)) {
      return;
    }

    const { resolve, reject } = this.pending.get(message.id);
    this.pending.delete(message.id);

    if (message.error) {
      reject(new Error(message.error.message));
      return;
    }

    resolve(message.result);
  }

  close() {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.socket.addEventListener('close', resolve, { once: true });
      this.socket.close();
    });
  }
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
