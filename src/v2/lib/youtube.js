/* ============================================================
   당첨노트 v2 — YouTube 댓글 후보 생성 글루
   현재 EventBodyToggle.jsx의 실제 Gemini 배선을 복제 이식(데이터 레이어 무수정).
   엔드포인트: POST /api/youtube-transcript 또는 Supabase Edge Function.
   ============================================================ */
import { buildUserContentLines } from '../../utils/eventModel.js';
import { getAuthToken, requireUnlock } from '../../storage/supabaseAuthStorage.js';
import { updateSupabaseEventState } from '../../storage/supabaseEventStorage.js';

export const YT_CONTEXT_TIMEOUT_MS = 35000;
export const YT_INFO_TIMEOUT_MS = 45000;

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const didCopy = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!didCopy) throw new Error('copy failed');
}

function getEndpoint() {
  if (API_BASE_URL) return `${API_BASE_URL}/api/youtube-transcript`;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return `${SUPABASE_URL}/functions/v1/youtube-transcript`;
  return '/api/youtube-transcript';
}

async function getHeaders(endpoint) {
  const headers = { 'content-type': 'application/json' };
  if (SUPABASE_URL && endpoint.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.authorization = `Bearer ${await getAuthToken()}`;
  }
  return headers;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error('댓글 후보 API 응답을 읽지 못했습니다.');
    }
  }
  const isStaticFallback = rawText.trim().startsWith('<') || contentType.includes('text/html');
  if (isStaticFallback) {
    throw new Error('댓글 후보 API가 연결되지 않았습니다. 로컬 dev 서버나 Supabase Edge Function 설정을 확인해 주세요.');
  }
  throw new Error(rawText.slice(0, 160) || '댓글 후보 API 응답 형식이 올바르지 않습니다.');
}

export function buildYoutubeLinks(event) {
  const raw = event.raw ?? {};
  return [event.applyTargetUrl, raw.applyTargetUrl, event.applyUrl, event.url, event.originalUrl, ...(raw.externalLinks ?? [])]
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .filter((url) => extractYoutubeVideoId(url));
}

function extractYoutubeVideoId(url) {
  const value = String(url ?? '');
  return (
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    value.match(/youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1] ??
    ''
  );
}

export function hasYoutubeLink(event) {
  return buildYoutubeLinks(event).length > 0;
}

// 영상 URL은 없지만 유튜브 카테고리 + suto 응모 링크(link.php)가 있으면,
// 백엔드가 그 리다이렉트를 따라가 영상에 도달할 수 있다.
export function hasResolvableYoutube(event) {
  if (hasYoutubeLink(event)) return true;
  const isYoutubeCategory = /youtube|유튜브/i.test(`${event.platform || ''} ${event.source || ''}`);
  const applyUrl = event.applyUrl || event.applyTargetUrl || event.url || '';
  return isYoutubeCategory && /\/bbs\/link\.php/i.test(applyUrl);
}

// fetch에 보낼 URL: 직접 영상 링크 우선, 없으면 응모 링크(서버가 redirect 해석)
export function youtubeFetchUrl(event) {
  return buildYoutubeLinks(event)[0] || event.applyUrl || event.applyTargetUrl || event.url || '';
}

export function normalizeSavedYoutubeContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.keys(value).length > 0 ? value : null;
}

export function persistYoutubeContext(eventId, youtubeContext) {
  if (!eventId || !youtubeContext) return;
  updateSupabaseEventState(eventId, { youtubeContext }).catch(() => {
    // 저장 실패는 댓글 생성 흐름을 막지 않는다.
  });
}

export async function fetchYoutubeContext({ event, mode, signal }) {
  const endpoint = getEndpoint();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await getHeaders(endpoint),
    signal,
    body: JSON.stringify({ mode, url: youtubeFetchUrl(event), eventInfo: buildCommentEventInfo(event) }),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    if (response.status === 401) requireUnlock();
    throw new Error(payload.error || '유튜브 자료를 가져오지 못했습니다.');
  }
  return payload;
}

export function buildCommentEventInfo(event) {
  const bodyLines = buildUserContentLines(event).slice(0, 24);
  const text = [event.title, event.platform, event.prizeText, event.prizeTitle, ...bodyLines].filter(Boolean).join('\n');
  return {
    title: event.title,
    platform: event.platform,
    deadline: event.deadlineDate || event.deadlineText || event.due || '',
    announcement: event.resultAnnouncementDate || event.resultAnnouncementText || '',
    prize: event.prizeText || event.prizeTitle || '',
    applyUrl: event.applyUrl || event.url || '',
    bodyLines,
    participationHints: inferParticipationHints(text),
  };
}

function inferParticipationHints(text) {
  const hints = [];
  const rules = [
    [/구독|구독자/, '구독 언급 가능'],
    [/좋아요|추천/, '좋아요 참여 가능'],
    [/댓글|정답|이유|기대평|응원/, '댓글 조건 확인'],
    [/공유|리그램|스토리/, '공유 조건 확인'],
    [/친구|태그|소환/, '친구 태그 조건 확인'],
    [/퀴즈|정답|문제/, '정답형 댓글 가능'],
  ];
  for (const [pattern, hint] of rules) {
    if (pattern.test(text) && !hints.includes(hint)) hints.push(hint);
  }
  return hints.slice(0, 5);
}

export function buildYoutubeCommentMaterialText(event, context) {
  if (!context) return '';
  const eventInfo = buildCommentEventInfo(event);
  const originalLines = eventInfo.bodyLines;
  const commentLines = (context.comments ?? []).slice(0, 20).map((c) => `- 좋아요 ${c.likes ?? 0}: ${c.text}`);
  const transcriptLines = getYoutubeTranscriptLines(event, context);
  const candidateLines = (context.commentCandidates ?? []).map(
    (candidate, index) => `${index + 1}. ${candidate.style ? `${candidate.style}: ` : ''}${candidate.text}`,
  );
  const youtubeUrl = context.url || buildYoutubeLinks(event)[0] || eventInfo.applyUrl || '';
  return [
    '[유튜브 이벤트 자료]', '',
    '아래 정보를 바탕으로 이벤트 댓글 후보를 만들어줘.',
    'AI가 쓴 설명문처럼 쓰지 말고, 영상과 이벤트 조건을 이해한 사람이 바로 댓글창에 남기는 말투로 작성해줘.', '',
    '[이벤트 정보]',
    `제목: ${eventInfo.title}`,
    `플랫폼: ${eventInfo.platform}`,
    `마감: ${eventInfo.deadline || '-'}`,
    `발표: ${eventInfo.announcement || '-'}`,
    `경품: ${eventInfo.prize || '-'}`,
    `참여 링크: ${eventInfo.applyUrl || '-'}`,
    `참여 힌트: ${eventInfo.participationHints.join(', ') || '-'}`, '',
    '[유튜브 영상 정보]',
    `영상 제목: ${context.title || '-'}`,
    `채널: ${context.channelName || '-'}`,
    `영상 URL: ${context.url || '-'}`,
    `업로드일: ${context.publishDate || '-'}`,
    `영상 길이: ${formatDuration(context.lengthSeconds)}`,
    `조회수: ${formatNumber(context.viewCount)}`,
    `좋아요 수: ${formatNumber(context.likeCount)}`,
    `댓글 수: ${formatNumber(context.commentCount)}`,
    `카테고리: ${context.category || '-'}`,
    `수집 경로: ${context.sourceApi === 'youtube-data-api' ? 'YouTube Data API' : '공개 페이지'}`,
    `키워드: ${context.keywords?.length ? context.keywords.join(', ') : '-'}`, '',
    '[영상 설명]', context.description || '-', '',
    '[영상 스크립트]', transcriptLines.length ? transcriptLines.join('\n') : context.transcript?.text || '-', '',
    '[이벤트 본문]', originalLines.join('\n') || '-', '',
    '[인기 댓글 참고]', commentLines.join('\n') || '-', '',
    '[생성된 추천 댓글]', candidateLines.join('\n') || '-', '',
    '[YouTube URL]', youtubeUrl || '-',
  ].join('\n');
}

function getYoutubeTranscriptLines(event, context) {
  if (Array.isArray(context?.transcript?.lines) && context.transcript.lines.length > 0) {
    return context.transcript.lines;
  }
  const transcripts = [
    ...(Array.isArray(event?.youtubeTranscripts) ? event.youtubeTranscripts : []),
    ...(Array.isArray(event?.raw?.youtubeTranscripts) ? event.raw.youtubeTranscripts : []),
  ];
  const crawled = transcripts.find(
    (t) => t?.status === 'ok' && (Array.isArray(t.lines) ? t.lines.length > 0 : t.text),
  );
  if (Array.isArray(crawled?.lines) && crawled.lines.length > 0) return crawled.lines;
  if (crawled?.text) return String(crawled.text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (context?.transcript?.text) return String(context.transcript.text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return [];
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
}
