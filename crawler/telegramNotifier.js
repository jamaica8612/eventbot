import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchYoutubeContext } from '../api/youtubeTranscriptCore.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const COMMENT_TIMEOUT_MS = 30000;

// 첫 크롤이나 대량 갱신 때 알림이 폭주하지 않도록 기본 상한/하한을 둔다.
const DEFAULT_MIN_SCORE = 60;
const DEFAULT_MAX_PER_RUN = 8;

export function canUseTelegram() {
  loadLocalEnv();
  return Boolean(getBotToken() && getChatId());
}

/**
 * 신규 이벤트를 텔레그램으로 발송한다.
 * - 클릭 점수 하한(TELEGRAM_NOTIFY_MIN_SCORE) 이상만,
 * - 1회 실행당 최대 TELEGRAM_MAX_NOTIFICATIONS_PER_RUN 건까지.
 * - 유튜브 이벤트는 Gemini로 추천 댓글을 생성해 함께 보낸다.
 * 토큰이 없으면 조용히 건너뛴다.
 */
export async function notifyNewEvents(events = []) {
  loadLocalEnv();
  if (!canUseTelegram()) {
    return { sent: 0, skipped: 'telegram_not_configured' };
  }

  const minScore = toNumber(process.env.TELEGRAM_NOTIFY_MIN_SCORE, DEFAULT_MIN_SCORE);
  const maxPerRun = toNumber(process.env.TELEGRAM_MAX_NOTIFICATIONS_PER_RUN, DEFAULT_MAX_PER_RUN);

  const targets = (Array.isArray(events) ? events : [])
    .filter((event) => toNumber(event?.clickScore, 0) >= minScore)
    .sort((a, b) => toNumber(b?.clickScore, 0) - toNumber(a?.clickScore, 0))
    .slice(0, maxPerRun);

  let sent = 0;
  for (const event of targets) {
    try {
      const comment = await maybeGenerateComment(event);
      await sendTelegramMessage(buildEventMessage(event, comment));
      sent += 1;
    } catch (error) {
      console.warn(`Telegram notify failed for "${event?.title ?? '?'}": ${error.message}`);
    }
  }

  if (sent > 0) {
    console.log(`Sent ${sent} Telegram notification(s).`);
  }
  return { sent };
}

export async function sendTelegramMessage(text) {
  const token = getBotToken();
  const chatId = getChatId();
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Telegram sendMessage ${response.status}: ${detail.slice(0, 200)}`);
  }
}

async function maybeGenerateComment(event) {
  const videoUrl = getYoutubeUrl(event);
  if (!videoUrl || !process.env.GEMINI_API_KEY) {
    return '';
  }

  try {
    const context = await withTimeout(
      fetchYoutubeContext({
        url: videoUrl,
        eventInfo: buildEventInfo(event),
        mode: 'candidates',
      }),
      COMMENT_TIMEOUT_MS,
      'Gemini 댓글 생성이 너무 오래 걸렸습니다.',
    );
    const candidate = Array.isArray(context?.commentCandidates) ? context.commentCandidates[0] : null;
    return candidate?.text ? String(candidate.text).trim() : '';
  } catch (error) {
    console.warn(`Comment generation skipped for "${event?.title ?? '?'}": ${error.message}`);
    return '';
  }
}

function buildEventInfo(event) {
  const bodyLines = Array.isArray(event?.originalLines) ? event.originalLines.slice(0, 36) : [];
  return {
    title: event?.originalTitle || event?.title || '',
    platform: event?.platform || '',
    deadline: event?.deadlineText || event?.due || '',
    announcement: event?.resultAnnouncementText || '',
    prize: event?.prizeText || '',
    bodyLines,
  };
}

function buildEventMessage(event, comment) {
  const score = toNumber(event?.clickScore, null);
  const lines = [];
  lines.push(score === null ? '🎯 새 이벤트' : `🎯 새 이벤트 (클릭점수 ${score})`);
  lines.push(`제목: ${event?.title || event?.originalTitle || '-'}`);
  if (event?.platform) lines.push(`플랫폼: ${event.platform}`);
  const deadline = event?.deadlineText || event?.due;
  if (deadline) lines.push(`마감: ${deadline}`);
  if (event?.prizeText) lines.push(`상품: ${event.prizeText}`);

  const applyUrl = event?.applyUrl || event?.applyTargetUrl || event?.url || event?.originalUrl;
  if (applyUrl) lines.push(`🔗 응모: ${applyUrl}`);

  if (comment) {
    lines.push('');
    lines.push('💬 추천 댓글 (복사해서 사용):');
    lines.push(comment);
  }

  return lines.join('\n');
}

function getYoutubeUrl(event) {
  const candidates = [
    event?.applyTargetUrl,
    event?.applyUrl,
    event?.url,
    event?.originalUrl,
    ...(Array.isArray(event?.externalLinks) ? event.externalLinks : []),
  ];
  for (const value of candidates) {
    const text = String(value ?? '');
    if (/youtube\.com|youtu\.be/i.test(text)) return text;
  }
  return '';
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getChatId() {
  return process.env.TELEGRAM_CHAT_ID;
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
