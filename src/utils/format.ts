export function parsePrizeAmount(value: unknown): number {
  return Number.parseInt(normalizePrizeAmountInput(value), 10) || 0;
}

// 자연어 금액 입력을 정규화한다. "억/만/천/나머지"를 각각 추출해 합산하므로
// "1만 5000"의 5000이나 "1억 2만 3000"의 2만·3000을 누락하지 않는다.
// 반환값은 저장/표시에 쓰는 숫자 문자열(빈 입력은 '').
export function normalizePrizeAmountInput(value: unknown): string {
  let text = String(value ?? '').replace(/[,\s원]/g, '');
  if (!text) return '';

  let total = 0;
  let matchedUnit = false;

  const eokMatch = text.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) {
    total += Math.round(Number(eokMatch[1]) * 1e8);
    text = text.replace(eokMatch[0], '');
    matchedUnit = true;
  }

  const manMatch = text.match(/(\d+(?:\.\d+)?)만/);
  if (manMatch) {
    total += Math.round(Number(manMatch[1]) * 1e4);
    text = text.replace(manMatch[0], '');
    matchedUnit = true;
  }

  const cheonMatch = text.match(/(\d+(?:\.\d+)?)천/);
  if (cheonMatch) {
    total += Math.round(Number(cheonMatch[1]) * 1e3);
    text = text.replace(cheonMatch[0], '');
    matchedUnit = true;
  }

  const restMatch = text.match(/\d+/);
  if (restMatch) {
    total += Number.parseInt(restMatch[0], 10);
    return String(total);
  }

  return matchedUnit ? String(total) : '';
}

export function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatCompactWon(value: number): string {
  if (value >= 10000) {
    return `${Math.round(value / 10000).toLocaleString('ko-KR')}만`;
  }
  return `${value.toLocaleString('ko-KR')}`;
}

export function formatSeconds(value: number): string {
  if (value < 60) {
    return `${value}초`;
  }
  return `${Math.round(value / 60)}분`;
}

export function formatDate(value?: string | number | Date | null): string {
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

export function formatAnnouncementDate(event: { resultAnnouncementDate?: string | null }): string {
  return event.resultAnnouncementDate ? formatDate(event.resultAnnouncementDate) : '-';
}

export function parseLocalDate(value?: string | null): Date | null {
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

export function getLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
