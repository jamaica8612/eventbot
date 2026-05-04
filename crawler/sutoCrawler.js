import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeAnnouncementByRules } from './eventDecision/announcementDecision.js';
import { analyzeEventByRules } from './eventDecision/ruleDecision.js';
import { canUseSupabase, upsertEvents } from './supabaseEventRepository.js';

const SOURCE_NAME = '슈퍼투데이';
const SOURCE_URL =
  'https://www.suto.co.kr/plugin/yun/ajax.hot_list.php?gr_id=cpevent&rows=80&hot_cnt=50&skin_dir=mo_simple';
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'crawled-events.json');

async function main() {
  const html = await fetchHtml(SOURCE_URL);
  const events = await hydrateEventDetails(parseSutoHotEvents(html));
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

// Cloudflare가 모바일 UA를 더 자주 의심하므로 데스크톱 UA를 1순위로 둔다.
const FETCH_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

function isCloudflareChallenge(status, html) {
  // Cloudflare는 챌린지 페이지를 403/503 + "Just a moment..." 본문으로 돌려준다.
  if (typeof html === 'string' && (html.includes('Just a moment') || html.includes('__cf_chl'))) {
    return true;
  }
  return status === 403 || status === 503;
}

async function fetchHtml(url, { retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const userAgent = FETCH_USER_AGENTS[attempt % FETCH_USER_AGENTS.length];
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ko-KR,ko;q=0.9,en;q=0.5',
          'user-agent': userAgent,
        },
      });

      // 응답 본문을 먼저 읽어 Cloudflare 챌린지 페이지 여부를 확인한다.
      const html = await response.text();

      if (isCloudflareChallenge(response.status, html)) {
        throw new Error('Cloudflare challenge page returned. Stop instead of bypassing it.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return html;
    } catch (error) {
      lastError = error;
      if (error.message.includes('Cloudflare')) {
        throw error;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function hydrateEventDetails(events) {
  const hydratedEvents = [];

  for (const event of events) {
    // 본문은 Cloudflare에 거의 다 막히는 게 현실이라 지연 없이 빠르게 시도만 한다.
    // 막히면 카드에 "원문에서 확인" CTA가 노출되도록 UI에서 처리한다.
    const detail = await fetchEventDetail(event.originalUrl);
    const lines = detail?.lines ?? event.originalLines ?? [];
    const text = detail?.text ?? event.originalText ?? '';
    const decision = analyzeEventByRules({
      ...event,
      dueText: event.due,
      bodyText: text,
      originalText: text,
      originalLines: lines,
    });
    const announcement = analyzeAnnouncementByRules({
      ...event,
      ...decision,
      bodyText: text,
      originalText: text,
      originalLines: lines,
    });

    hydratedEvents.push({
      ...event,
      ...decision,
      ...announcement,
      originalText: text,
      originalLines: lines,
      detailCrawlStatus: detail?.status ?? 'blocked',
    });
  }

  return hydratedEvents;
}

async function fetchEventDetail(url) {
  try {
    const html = await fetchHtml(url);
    const lines = extractDetailLines(html);

    if (lines.length === 0) {
      return { status: 'empty', text: '', lines: [] };
    }

    return {
      status: 'ok',
      text: lines.join('\n'),
      lines,
    };
  } catch (error) {
    return {
      status: error.message.includes('Cloudflare') ? 'blocked' : 'failed',
      text: '',
      lines: [],
    };
  }
}

function parseEventAnchor(href, innerHtml) {
  const title = extractTextByClass(innerHtml, 'subject');
  if (!title || !href.includes('/cpevent/')) {
    return null;
  }

  const platform = extractImageTitle(innerHtml) || '이벤트';
  const eventId = href.match(/\/cpevent\/(\d+)/)?.[1] ?? slugify(href);
  const originalUrl = normalizeUrl(href);
  const applyUrl = buildApplyUrl(eventId);
  const rank = extractNumberByClass(innerHtml, 'rank_num');
  const bookmarkCount = extractNumberByClass(innerHtml, 'save_cnt');
  const due = '상세 확인 필요';
  const decision = analyzeEventByRules({
    title,
    platform,
    bookmarkCount,
    rank,
    dueText: due,
  });

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
    due,
    deadlineText: decision.deadlineText,
    clickScore: decision.clickScore,
    actionType: decision.actionType,
    estimatedSeconds: decision.estimatedSeconds,
    decisionReason: decision.decisionReason,
    prizeText: decision.prizeText,
    effort: decision.effort,
    effortLabel: decision.effortLabel,
    status: 'ready',
    memo: decision.decisionReason,
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

function extractDetailLines(html) {
  const candidates = [
    extractHtmlByClass(html, 'view-content'),
    extractHtmlByClass(html, 'view_content'),
    extractHtmlByClass(html, 'bo_v_con'),
    extractHtmlById(html, 'bo_v_con'),
    extractHtmlByClass(html, 'event_view'),
    extractHtmlByTag(html, 'article'),
  ].filter(Boolean);

  const sourceHtml = candidates[0] ?? '';
  return htmlToTextLines(sourceHtml)
    .filter((line) => !/^목록|^이전글|^다음글|^댓글|^로그인/.test(line))
    .slice(0, 24);
}

function extractHtmlByClass(html, className) {
  const match = html.match(
    new RegExp(`<([a-z0-9]+)\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  );
  return match?.[2] ?? '';
}

function extractHtmlById(html, id) {
  const match = html.match(
    new RegExp(`<([a-z0-9]+)\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  );
  return match?.[2] ?? '';
}

function extractHtmlByTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1] ?? '';
}

function htmlToTextLines(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '\n'),
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function shouldKeepEvent(event) {
  const text = `${event.title} ${event.platform}`;
  return event.platform !== '인스타그램 이벤트';
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
