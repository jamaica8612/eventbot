import { getLocalToday, parseLocalDate, formatDate } from './format.js';

export function getTodayDeadlineMatch(event) {
  if (event.status === 'done' || event.status === 'skipped') {
    return { isMatch: false, isExact: false };
  }

  const deadline = parseLocalDate(event.deadlineDate);
  const today = getLocalToday();
  if (deadline) {
    return {
      isMatch: deadline.getTime() === today.getTime(),
      isExact: true,
    };
  }

  const todayHints = buildTodayTextHints(today);
  const text = [
    event.deadlineText,
    event.due,
    event.memo,
    event.originalText,
    ...(Array.isArray(event.originalLines) ? event.originalLines : []),
    ...(Array.isArray(event.raw?.originalLines) ? event.raw.originalLines : []),
  ]
    .filter(Boolean)
    .join(' ');
  const hasTodayText =
    /오늘\s*마감|금일\s*마감|마감\s*오늘|오늘\s*종료|금일\s*종료/.test(text) ||
    todayHints.some((hint) => text.includes(hint));

  return { isMatch: hasTodayText, isExact: false };
}

export function getUpcomingDeadlineMatch(event) {
  if (event.status === 'done' || event.status === 'skipped') {
    return {
      isMatch: false,
      isExact: false,
      diffDays: Number.MAX_SAFE_INTEGER,
      bucket: 'unknown',
      label: '마감 확인 필요',
    };
  }

  const deadline = parseLocalDate(event.deadlineDate);
  const today = getLocalToday();
  if (deadline) {
    const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000);
    return {
      isMatch: diffDays >= 0,
      isExact: true,
      diffDays,
      bucket: getDeadlineBucket(diffDays),
      label: formatDeadlineLabel(diffDays, deadline),
    };
  }

  const todayMatch = getTodayDeadlineMatch(event);
  if (todayMatch.isMatch) {
    return {
      isMatch: true,
      isExact: false,
      diffDays: 0,
      bucket: 'today',
      label: '오늘 마감',
    };
  }

  const text = [
    event.deadlineText,
    event.due,
    event.memo,
    event.originalText,
    ...(Array.isArray(event.originalLines) ? event.originalLines : []),
    ...(Array.isArray(event.raw?.originalLines) ? event.raw.originalLines : []),
  ]
    .filter(Boolean)
    .join(' ');

  if (/내일\s*마감|마감\s*내일|내일\s*종료/.test(text)) {
    return {
      isMatch: true,
      isExact: false,
      diffDays: 1,
      bucket: 'tomorrow',
      label: '내일 마감',
    };
  }

  return {
    isMatch: true,
    isExact: false,
    diffDays: Number.MAX_SAFE_INTEGER,
    bucket: 'unknown',
    label: event.deadlineText || event.due || '마감 확인 필요',
  };
}

function getDeadlineBucket(diffDays) {
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'week';
  return 'later';
}

function formatDeadlineLabel(diffDays, deadline) {
  if (diffDays === 0) return '오늘 마감';
  if (diffDays === 1) return '내일 마감';
  if (diffDays < 0) return `${Math.abs(diffDays)}일 지남`;
  return `${formatDate(deadline.toISOString())} 마감`;
}

function buildTodayTextHints(today) {
  const month = today.getMonth() + 1;
  const day = today.getDate();
  return [
    `${month}.${day}`,
    `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
    `${month}/${day}`,
    `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
    `${month}월 ${day}일`,
    `${month}월${day}일`,
  ];
}

export function sortTodayDeadlineEvents(events) {
  return [...events].sort((first, second) => {
    const firstMatch = getUpcomingDeadlineMatch(first);
    const secondMatch = getUpcomingDeadlineMatch(second);
    if (firstMatch.diffDays !== secondMatch.diffDays) {
      return firstMatch.diffDays - secondMatch.diffDays;
    }
    if (firstMatch.isExact !== secondMatch.isExact) {
      return firstMatch.isExact ? -1 : 1;
    }
    return (
      getNumber(second.bookmarkCount) - getNumber(first.bookmarkCount) ||
      getNumber(first.rank) - getNumber(second.rank)
    );
  });
}

function getNumber(value) {
  return Number.isFinite(value) ? value : 0;
}
