import { analyzeAnnouncementByRules } from '../../crawler/eventDecision/announcementDecision.js';
import { getFallbackDecision } from '../../crawler/eventDecision/ruleDecision.js';
import { getLocalToday, parseLocalDate, formatDate } from './format.js';
import { getUpcomingDeadlineMatch } from './deadlineModel.js';
export { getTodayDeadlineMatch, getUpcomingDeadlineMatch, sortTodayDeadlineEvents } from './deadlineModel.js';

export const FALLBACK_BODY_LINE =
  '아직 상세 본문이 수집되지 않았습니다. 참여하기를 누르면 원문에서 확인할 수 있어요.';

export const PRIZE_FALLBACK = '경품 정보 미수집';

export function hasCrawledBody(event) {
  // EventBodyToggle/카드가 "원문에서 확인" 단순 안내로 분기할 때 사용한다.
  const lines = buildUserContentLines(event);
  return !(lines.length === 1 && lines[0] === FALLBACK_BODY_LINE);
}

export function enrichEvent(event) {
  const announcement = getFallbackAnnouncement(event);
  return {
    ...event,
    ...getFallbackDecision(event),
    resultAnnouncementDate: event.resultAnnouncementDate || announcement.date,
    resultAnnouncementText: event.resultAnnouncementText || announcement.text,
  };
}

function getFallbackAnnouncement(event) {
  const raw = event.raw ?? {};
  const announcement = analyzeAnnouncementByRules({
    ...event,
    originalText:
      event.originalText ?? raw.originalText ?? raw.contentText ?? raw.bodyText,
    originalLines: event.originalLines ?? raw.originalLines,
    bodyLines: raw.bodyLines,
  });
  return {
    date: announcement.resultAnnouncementDate,
    text: announcement.resultAnnouncementText,
  };
}

export function matchesFilter(event, filter, filterSettings) {
  if (isHiddenByFilterSettings(event, filterSettings)) return false;
  if (shouldHideExpiredEvent(event, filter)) return false;

  if (filter === 'ready') return event.status === 'ready' || event.status === 'later';
  if (filter === 'todayDeadline') return getUpcomingDeadlineMatch(event).isMatch;
  if (filter === 'search') return event.status !== 'skipped';
  if (filter === 'inbox') return event.status === 'done';
  if (filter === 'done') return event.status === 'done';
  if (filter === 'todayAnnouncement') return matchesTodayAnnouncement(event);
  if (filter === 'won') return event.resultStatus === 'won';
  return event.status === filter;
}

export function isExpiredEvent(event) {
  const deadline = parseLocalDate(event.deadlineDate);
  if (!deadline) return false;
  return deadline.getTime() < getLocalToday().getTime();
}

function shouldHideExpiredEvent(event, filter) {
  if (!isExpiredEvent(event)) return false;
  if (event.status === 'done') return false;
  return ['ready', 'todayDeadline', 'search', 'skipped'].includes(filter);
}

export function isHiddenByFilterSettings(event, filterSettings) {
  if (!filterSettings) return false;

  const hiddenPlatforms = new Set(filterSettings.hiddenPlatforms ?? []);
  if (hiddenPlatforms.has(event.platform)) return true;

  const text = normalizeSearchText(
    [
      event.title,
      event.originalTitle,
      event.platform,
      event.source,
      event.prizeText,
      event.deadlineText,
      event.decisionReason,
      event.originalText,
      ...(Array.isArray(event.originalLines) ? event.originalLines : []),
    ].filter(Boolean).join(' '),
  );

  return (filterSettings.excludedKeywords ?? []).some((keyword) =>
    text.includes(normalizeSearchText(keyword)),
  );
}

export function matchesSearchQuery(event, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeSearchText(
    [
      event.title,
      event.originalTitle,
      event.platform,
      event.source,
      event.prizeText,
      event.prizeTitle,
      event.deadlineText,
      event.resultAnnouncementText,
      event.memo,
      event.decisionReason,
      event.originalText,
      ...(Array.isArray(event.originalLines) ? event.originalLines : []),
      ...(Array.isArray(event.raw?.originalLines) ? event.raw.originalLines : []),
      ...(Array.isArray(event.raw?.detailMetaLines) ? event.raw.detailMetaLines : []),
    ].filter(Boolean).join(' '),
  );

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function sortSearchEvents(events) {
  return [...events].sort(
    (first, second) =>
      getSearchStatusPriority(first) - getSearchStatusPriority(second) ||
      getNumber(second.bookmarkCount) - getNumber(first.bookmarkCount) ||
      getNumber(first.rank) - getNumber(second.rank),
  );
}

function normalizeSearchText(value) {
  return String(value ?? '').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
}

function getSearchStatusPriority(event) {
  if (event.status === 'ready') return 0;
  if (event.status === 'later') return 1;
  if (event.status === 'done') return 2;
  return 3;
}

export function matchesTodayAnnouncement(event) {
  if (event.status !== 'done' || event.resultStatus !== 'unknown') {
    return false;
  }
  return Boolean(event.resultAnnouncementDate || event.resultAnnouncementText);
}

export function getAnnouncementStatus(event) {
  const date = parseLocalDate(event.resultAnnouncementDate);
  if (!date) {
    return { state: 'unknown', label: event.resultAnnouncementText || '발표일 미정' };
  }
  const today = getLocalToday();
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { state: 'overdue', label: `${Math.abs(diffDays)}일 지남` };
  if (diffDays === 0) return { state: 'today', label: '오늘 발표' };
  return { state: 'future', label: `${formatDate(date.toISOString())} 발표` };
}

export function getAnnouncementTime(event) {
  const date = parseLocalDate(event.resultAnnouncementDate);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

export function sortTodayAnnouncements(events) {
  const priority = { overdue: 0, today: 1, future: 2, unknown: 3 };
  return [...events].sort((first, second) => {
    const firstStatus = getAnnouncementStatus(first);
    const secondStatus = getAnnouncementStatus(second);
    const statusDiff = priority[firstStatus.state] - priority[secondStatus.state];
    if (statusDiff !== 0) return statusDiff;
    return getAnnouncementTime(first) - getAnnouncementTime(second);
  });
}

export function sortInboxEvents(events) {
  const priority = { overdue: 0, today: 1, future: 3, unknown: 4 };
  return [...events].sort((first, second) => {
    const firstStatus = getAnnouncementStatus(first);
    const secondStatus = getAnnouncementStatus(second);
    const firstScore = getInboxPriority(first, firstStatus, priority);
    const secondScore = getInboxPriority(second, secondStatus, priority);
    if (firstScore !== secondScore) return firstScore - secondScore;
    return getInboxTime(second) - getInboxTime(first);
  });
}

function getInboxPriority(event, announcement, priority) {
  if (event.resultStatus === 'unknown') return priority[announcement.state] ?? 4;
  if (event.resultStatus === 'won' && event.receiptStatus !== 'received') return 2;
  if (event.resultStatus === 'won') return 5;
  if (event.resultStatus === 'lost') return 6;
  return 7;
}

function getInboxTime(event) {
  const value = event.participatedAt ?? event.resultCheckedAt ?? event.lastSeenAt ?? '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

export function buildPlatformOptions(events) {
  const counts = events.reduce((acc, event) => {
    const platform = event.platform || '기타 이벤트';
    acc.set(platform, (acc.get(platform) ?? 0) + 1);
    return acc;
  }, new Map());

  return [...counts.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort(
      (first, second) =>
        second.count - first.count ||
        first.platform.localeCompare(second.platform, 'ko-KR'),
    );
}

export function buildStatusPatch(event, status, changedAt) {
  if (status === 'done') {
    return {
      status,
      resultStatus: 'unknown',
      participatedAt: event?.participatedAt ?? changedAt,
    };
  }
  return { status, resultStatus: 'unknown', resultCheckedAt: null };
}

export function applyStatusChange(event, status, changedAt) {
  if (status === 'done') {
    return {
      ...event,
      status,
      resultStatus: event.resultStatus ?? 'unknown',
      participatedAt: event.participatedAt ?? changedAt,
    };
  }
  return { ...event, status, resultStatus: 'unknown', resultCheckedAt: null };
}

// --- Content helpers ---
export function buildSourceFacts(event) {
  return [
    event.platform,
    Number.isFinite(event.bookmarkCount) ? `저장 ${event.bookmarkCount}` : null,
    Number.isFinite(event.rank) ? `목록 ${event.rank}위` : null,
  ].filter(Boolean);
}

export function getPrizeDisplay(event) {
  const raw = event.raw ?? {};
  const announcementPrize = analyzeAnnouncementByRules({
    ...event,
    prizeText: event.prizeText ?? raw.prizeText,
    originalText: event.originalText ?? raw.originalText ?? raw.contentText ?? raw.bodyText,
    originalLines: event.originalLines ?? raw.originalLines,
    bodyLines: raw.bodyLines,
  }).prizeText;

  return (
    event.prizeTitle ||
    event.prizeText ||
    raw.prizeText ||
    announcementPrize ||
    PRIZE_FALLBACK
  );
}

export function buildPreviewLines(event, facts) {
  if (Array.isArray(event.originalLines) && event.originalLines.length > 0) {
    return event.originalLines;
  }
  if (event.originalText) {
    return event.originalText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [
    event.originalTitle ?? event.title,
    facts.length > 0 ? facts.join(' · ') : event.memo,
    '상세 조건은 참여하기에서 확인합니다.',
  ];
}

export function buildUserContentLines(event) {
  const raw = event.raw ?? {};
  const possibleLineSets = [
    event.originalLines,
    raw.originalLines,
    raw.contentLines,
    raw.bodyLines,
  ];

  for (const lines of possibleLineSets) {
    if (Array.isArray(lines) && lines.length > 0) {
      return normalizeContentLines(lines, event);
    }
  }

  const possibleText = [
    event.originalText,
    raw.originalText,
    raw.contentText,
    raw.bodyText,
    raw.detailText,
  ].find((value) => typeof value === 'string' && value.trim());

  if (possibleText) {
    return normalizeContentLines(possibleText.split(/\n+/), event);
  }

  return [FALLBACK_BODY_LINE];
}

function normalizeContentLines(lines, event) {
  const title = String(event.originalTitle ?? event.title ?? '').trim();
  const seen = new Set();
  const normalized = [];

  for (const rawLine of lines) {
    const line = String(rawLine).replace(/\s+/g, ' ').trim();
    if (!line || line === title || seen.has(line)) continue;
    seen.add(line);
    normalized.push(line);
    if (normalized.length >= 24) break;
  }

  return normalized.length > 0 ? normalized : [FALLBACK_BODY_LINE];
}
