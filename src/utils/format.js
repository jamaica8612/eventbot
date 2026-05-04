export function parsePrizeAmount(value) {
  return Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10) || 0;
}

export function formatWon(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatCompactWon(value) {
  if (value >= 10000) {
    return `${Math.round(value / 10000).toLocaleString('ko-KR')}만`;
  }
  return `${value.toLocaleString('ko-KR')}`;
}

export function formatSeconds(value) {
  if (value < 60) {
    return `${value}초`;
  }
  return `${Math.round(value / 60)}분`;
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatAnnouncementDate(event) {
  return event.resultAnnouncementDate ? formatDate(event.resultAnnouncementDate) : '-';
}

export function parseLocalDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getLocalToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
