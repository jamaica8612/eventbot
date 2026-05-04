import { analyzeAnnouncementByRules } from '../../crawler/eventDecision/announcementDecision.js';
import { getFallbackDecision } from '../../crawler/eventDecision/ruleDecision.js';
import { getLocalToday, parseLocalDate, parsePrizeAmount, formatDate } from './format.js';

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

export function matchesFilter(event, filter) {
  if (filter === 'now') return event.status === 'ready' && event.actionType === 'now';
  if (filter === 'home') {
    return event.status === 'later' || (event.status === 'ready' && event.actionType === 'home');
  }
  if (filter === 'done') return event.status === 'done';
  if (filter === 'todayAnnouncement') return matchesTodayAnnouncement(event);
  if (filter === 'won') return event.resultStatus === 'won';
  return event.status === filter;
}

export function matchesTodayAnnouncement(event) {
  if (event.status !== 'done' || event.resultStatus !== 'unknown') {
    return false;
  }
  const announcement = getAnnouncementStatus(event);
  return announcement.state !== 'future';
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
  const priority = { overdue: 0, today: 1, unknown: 2, future: 3 };
  return [...events].sort((first, second) => {
    const firstStatus = getAnnouncementStatus(first);
    const secondStatus = getAnnouncementStatus(second);
    const statusDiff = priority[firstStatus.state] - priority[secondStatus.state];
    if (statusDiff !== 0) return statusDiff;
    return getAnnouncementTime(first) - getAnnouncementTime(second);
  });
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

// --- Winning helpers ---
export function getWinningDateValue(event) {
  return event.resultCheckedAt ?? event.participatedAt ?? null;
}

export function getWinningTime(event) {
  const value = getWinningDateValue(event);
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function sortWinningEvents(events) {
  return [...events].sort((first, second) => getWinningTime(second) - getWinningTime(first));
}

function getWinningMonthKey(event) {
  const value = getWinningDateValue(event);
  if (!value) return { key: 'unknown', label: '날짜 미확인' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { key: 'unknown', label: '날짜 미확인' };
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
  };
}

export function buildWinningMonthGroups(events) {
  const groups = events.reduce((acc, event) => {
    const groupKey = getWinningMonthKey(event);
    const currentGroup =
      acc.get(groupKey.key) ??
      { ...groupKey, events: [], totalAmount: 0, unreceivedCount: 0 };
    currentGroup.events.push(event);
    currentGroup.totalAmount += parsePrizeAmount(event.prizeAmount);
    if (event.receiptStatus !== 'received') currentGroup.unreceivedCount += 1;
    acc.set(groupKey.key, currentGroup);
    return acc;
  }, new Map());
  return [...groups.values()];
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
