import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canUseSupabase, upsertEvents } from './supabaseEventRepository.js';

const SOURCE_NAME = '슈퍼투데이';
const SOURCE_URL =
  'https://www.suto.co.kr/plugin/yun/ajax.hot_list.php?gr_id=cpevent&rows=40&hot_cnt=10&skin_dir=mo_simple';
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'crawled-events.json');

const effortLabels = {
  quick: '현장 딸각',
  home: '집에서 처리',
  hard: '복잡함',
};

async function main() {
  const html = await fetchHtml(SOURCE_URL);
  const events = parseSutoHotEvents(html);
  const payload = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    crawledAt: new Date().toISOString(),
    note: '슈퍼투데이 인기 이벤트 AJAX 목록에서 수집했습니다. 상세 페이지는 Cloudflare 확인 화면으로 막힐 수 있어 링크만 저장합니다.',
    events,
  };

  if (canUseSupabase()) {
    const savedCount = await upsertEvents(events);
    console.log(`Upserted ${savedCount} events to Supabase`);
    return;
  }

  await saveJsonPayload(payload);
  console.log(`Saved ${events.length} events to ${OUTPUT_PATH}`);
}

async function saveJsonPayload(payload) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'EventClickCrawler/0.1 (+local development)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  if (html.includes('Just a moment') || html.includes('__cf_chl')) {
    throw new Error('Cloudflare challenge page returned. Stop instead of bypassing it.');
  }

  return html;
}

function parseSutoHotEvents(html) {
  const anchorMatches = [
    ...html.matchAll(
      /<a\b[^>]*class=["'][^"']*hot_item_link[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];

  return anchorMatches
    .map((match) => parseEventAnchor(match[1], match[2]))
    .filter((event) => event && shouldKeepEvent(event));
}

function parseEventAnchor(href, innerHtml) {
  const title = extractTextByClass(innerHtml, 'subject');
  if (!title || !href.includes('/cpevent/')) {
    return null;
  }

  const platform = extractImageTitle(innerHtml) || '이벤트';
  const eventId = href.match(/\/cpevent\/(\d+)/)?.[1] ?? slugify(href);
  const effort = inferEffort(title, platform);
  const originalUrl = normalizeUrl(href);
  const applyUrl = buildApplyUrl(eventId);
  const rank = extractNumberByClass(innerHtml, 'rank_num');
  const bookmarkCount = extractNumberByClass(innerHtml, 'save_cnt');

  return {
    id: `suto-${eventId}`,
    title,
    originalTitle: title,
    originalUrl,
    applyUrl,
    source: `${SOURCE_NAME} · ${platform}`,
    platform,
    rank,
    bookmarkCount,
    due: '상세 확인 필요',
    effort,
    effortLabel: effortLabels[effort],
    status: 'ready',
    memo: '슈퍼투데이에서 불러온 이벤트입니다. 원문 링크에서 참여 조건과 마감을 확인하세요.',
    url: originalUrl,
    crawledFrom: SOURCE_NAME,
  };
}

function extractTextByClass(html, className) {
  const pattern = new RegExp(
    `<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    'i',
  );
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : '';
}

function extractImageTitle(html) {
  const match = html.match(/<img\b[^>]*title=["']([^"']+)["'][^>]*>/i);
  return match ? decodeHtml(match[1]) : '';
}

function extractNumberByClass(html, className) {
  const classMatch = html.match(
    new RegExp(`class=["'][^"']*${className}[^"']*["'][\\s\\S]*?(\\d+)[\\s\\S]*?<\\/span>`, 'i'),
  );
  if (classMatch) {
    return Number(classMatch[1]);
  }

  const text = extractTextByClass(html, className);
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function cleanText(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function inferEffort(title, platform) {
  const text = `${title} ${platform}`;
  if (/댓글|유튜브|인스타|팔로우|공유|리그램|친구|태그/.test(text)) {
    return 'home';
  }

  if (/설문|조사|서포터즈|공모|아이디어|후기|리뷰/.test(text)) {
    return 'hard';
  }

  return 'quick';
}

function shouldKeepEvent(event) {
  const text = `${event.title} ${event.platform}`;
  return event.platform !== '인스타그램 이벤트' && !/출석|출첵|체크인/.test(text);
}

function normalizeUrl(href) {
  return new URL(href, 'https://www.suto.co.kr').toString();
}

function buildApplyUrl(eventId) {
  return `https://www.suto.co.kr/bbs/link.php?bo_table=cpevent&wr_id=${eventId}&no=1`;
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
