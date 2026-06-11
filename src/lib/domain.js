/**
 * src/lib/domain.js — 도메인 로직 단일 소스
 *
 * 날짜·금액·정렬·라벨 로직을 한 파일로 수렴.
 * JSX 없음, 순수 JS.
 *
 * 기존 파일(eventModel.js, deadlineModel.js, format.js, constants.js)은
 * 삭제하지 않고 re-export 래퍼로 유지한다.
 */

// ---------------------------------------------------------------------------
// 내부 날짜 헬퍼
// ---------------------------------------------------------------------------

function getLocalToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseLocalDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 오늘 기준 일수 차이 (양수=미래, 음수=과거) */
function dayDiff(isoOrNull) {
  if (!isoOrNull) return null;
  const date = parseLocalDate(isoOrNull);
  if (!date) return null;
  const today = getLocalToday();
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

/** "M/D" 포맷 */
function fmtMD(isoOrNull) {
  if (!isoOrNull) return '';
  const date = parseLocalDate(isoOrNull);
  if (!date) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ---------------------------------------------------------------------------
// deadlineMeta(isoOrNull)
// ---------------------------------------------------------------------------

/**
 * 마감일 메타 정보를 반환한다.
 *
 * @param {string|null} isoOrNull - ISO 날짜 문자열 (YYYY-MM-DD) 또는 null
 * @returns {{ key: string, label: string, tone: string }}
 *   key: 'today'|'tomorrow'|'soon'|'date'|'unknown'|'passed'
 *   tone: 'urgent'|'warn'|'info'|'muted'
 *   label: DESIGN_RULES §9 기준
 */
export function deadlineMeta(isoOrNull) {
  if (!isoOrNull) {
    return { key: 'unknown', label: '마감 미확인', tone: 'muted' };
  }
  const dd = dayDiff(isoOrNull);
  if (dd === null) {
    return { key: 'unknown', label: '마감 미확인', tone: 'muted' };
  }
  if (dd < 0) {
    return { key: 'passed', label: '마감 지남', tone: 'muted' };
  }
  if (dd === 0) {
    return { key: 'today', label: '오늘 마감', tone: 'urgent' };
  }
  if (dd === 1) {
    return { key: 'tomorrow', label: '내일 마감', tone: 'warn' };
  }
  if (dd <= 6) {
    return { key: 'soon', label: `${dd}일 후 마감`, tone: 'info' };
  }
  // 7일 이후
  return { key: 'date', label: `마감 ${fmtMD(isoOrNull)}`, tone: 'muted' };
}

// ---------------------------------------------------------------------------
// announceMeta(isoOrNull)
// ---------------------------------------------------------------------------

/**
 * 발표일 메타 정보를 반환한다.
 *
 * @param {string|null} isoOrNull - ISO 날짜 문자열 (YYYY-MM-DD) 또는 null
 * @returns {{ key: string, label: string, tone: string, priority: number }}
 *   key: 'passed'|'today'|'soon'|'unknown'
 *   priority: 0(passed)→1(today)→2(soon)→3(unknown) — 낮을수록 먼저 표시
 *   tone: 'urgent'(passed)|'warn'(today)|'info'(soon)|'muted'(unknown)
 *   label: DESIGN_RULES §9 기준
 */
export function announceMeta(isoOrNull) {
  if (!isoOrNull) {
    return { key: 'unknown', label: '발표일 미정', tone: 'muted', priority: 3 };
  }
  const dd = dayDiff(isoOrNull);
  if (dd === null) {
    return { key: 'unknown', label: '발표일 미정', tone: 'muted', priority: 3 };
  }
  if (dd < 0) {
    return { key: 'passed', label: '발표일 지남', tone: 'urgent', priority: 0 };
  }
  if (dd === 0) {
    return { key: 'today', label: '오늘 발표', tone: 'warn', priority: 1 };
  }
  return { key: 'soon', label: `${dd}일 후 발표`, tone: 'info', priority: 2 };
}

// ---------------------------------------------------------------------------
// inboxSortKey(event)
// ---------------------------------------------------------------------------

/**
 * 응모함 정렬 키를 반환한다. 배열 비교로 낮을수록 먼저 표시.
 *
 * 정렬 우선순위 (DESIGN_RULES §7):
 *   1. 발표일 지남 / 오늘 발표 (시급) — resultStatus='unknown' + announcement passed/today
 *   2. 발표일 예정 / 미정 — resultStatus='unknown'
 *   3. 미수령 당첨 (receiptStatus='unclaimed')
 *   4. 수령 요청 중 (receiptStatus='requested')
 *   5. 당첨 수령완료 (receiptStatus='received')
 *   6. 미당첨 (resultStatus='lost')
 *   7. 기타
 *
 * @param {object} event
 * @returns {number[]} [p0, p1, timestamp]
 */
export function inboxSortKey(event) {
  const announce = announceMeta(event.resultAnnouncementDate ?? null);

  // 결과 미확인 — 발표 시급도 순
  if (event.resultStatus === 'unknown') {
    const time = event.resultAnnouncementDate
      ? (parseLocalDate(event.resultAnnouncementDate)?.getTime() ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    return [0, announce.priority, time];
  }

  // 당첨
  if (event.resultStatus === 'won') {
    const receiptOrder = { unclaimed: 0, requested: 1, received: 2 };
    const r = receiptOrder[event.receiptStatus] ?? 0;
    const time = -getInboxTime(event);
    return [1, r, time];
  }

  // 미당첨
  if (event.resultStatus === 'lost') {
    return [2, 0, -getInboxTime(event)];
  }

  // 기타
  return [3, 0, -getInboxTime(event)];
}

function getInboxTime(event) {
  const value = event.participatedAt ?? event.resultCheckedAt ?? event.lastSeenAt ?? '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// ---------------------------------------------------------------------------
// parseAmount(str)
// ---------------------------------------------------------------------------

/**
 * 한글 자연어 금액 문자열을 숫자로 파싱한다.
 * 예: "1만 5000" → 15000, "3만" → 30000, "2억" → 200000000
 *
 * @param {string|number|null|undefined} str
 * @returns {number}
 */
export function parseAmount(str) {
  if (!str) return 0;
  let s = String(str).replace(/[,\s원]/g, '');
  let total = 0;
  const eok = s.match(/(\d+(?:\.\d+)?)억/);
  if (eok) {
    total += Math.round(Number(eok[1]) * 1e8);
    s = s.replace(eok[0], '');
  }
  const man = s.match(/(\d+(?:\.\d+)?)만/);
  if (man) {
    total += Math.round(Number(man[1]) * 1e4);
    s = s.replace(man[0], '');
  }
  const cheon = s.match(/(\d+(?:\.\d+)?)천/);
  if (cheon) {
    total += Math.round(Number(cheon[1]) * 1e3);
    s = s.replace(cheon[0], '');
  }
  const rest = s.match(/(\d+)/);
  if (rest) total += parseInt(rest[1], 10);
  return total;
}

// ---------------------------------------------------------------------------
// won(n)
// ---------------------------------------------------------------------------

/**
 * 숫자를 "N원" 형식으로 변환한다 (천 단위 콤마).
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function won(n) {
  return `${(n || 0).toLocaleString('ko-KR')}원`;
}

// ---------------------------------------------------------------------------
// wonShort(n)
// ---------------------------------------------------------------------------

/**
 * 숫자를 "N만원" 또는 "N만 M천원" 등 축약 형식으로 변환한다.
 * 항상 "원" suffix를 붙인다.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function wonShort(n) {
  if (!n) return '0원';
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    const rest = n % 10000;
    if (rest === 0) return `${man.toLocaleString('ko-KR')}만원`;
    if (rest >= 1000) {
      const cheon = Math.floor(rest / 1000);
      const sub = rest % 1000;
      if (sub === 0) return `${man.toLocaleString('ko-KR')}만 ${cheon}천원`;
    }
    return `${man.toLocaleString('ko-KR')}만 ${rest.toLocaleString('ko-KR')}원`;
  }
  return `${n.toLocaleString('ko-KR')}원`;
}

// ---------------------------------------------------------------------------
// deadlineFilterMatch(event, bucket)
// ---------------------------------------------------------------------------

/**
 * 이벤트가 주어진 마감 버킷에 해당하는지 반환한다.
 *
 * @param {object} event
 * @param {'all'|'today'|'tomorrow'|'week'|'unknown'} bucket
 * @returns {boolean}
 */
export function deadlineFilterMatch(event, bucket) {
  if (bucket === 'all') return true;

  const deadline = parseLocalDate(event.deadlineDate);
  const today = getLocalToday();

  if (deadline) {
    const diffDays = Math.round((deadline.getTime() - today.getTime()) / 86400000);
    if (bucket === 'today') return diffDays === 0;
    if (bucket === 'tomorrow') return diffDays === 1;
    if (bucket === 'week') return diffDays >= 0 && diffDays <= 7;
    if (bucket === 'unknown') return false;
    return false;
  }

  // 날짜 필드 없을 때 텍스트 힌트로 판단 (today / tomorrow 버킷만)
  if (bucket === 'unknown') return true;

  const text = [
    event.deadlineText,
    event.due,
    event.memo,
    event.originalText,
    ...(Array.isArray(event.originalLines) ? event.originalLines : []),
    ...(Array.isArray(event.raw?.originalLines) ? event.raw?.originalLines : []),
  ]
    .filter(Boolean)
    .join(' ');

  if (bucket === 'today') {
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const hints = [
      `${month}.${day}`,
      `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
      `${month}/${day}`,
      `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
      `${month}월 ${day}일`,
      `${month}월${day}일`,
    ];
    return (
      /오늘\s*마감|금일\s*마감|마감\s*오늘|오늘\s*종료|금일\s*종료/.test(text) ||
      hints.some((hint) => text.includes(hint))
    );
  }

  if (bucket === 'tomorrow') {
    return /내일\s*마감|마감\s*내일|내일\s*종료/.test(text);
  }

  return false;
}

// ---------------------------------------------------------------------------
// LABELS (상수 export)
// ---------------------------------------------------------------------------

/**
 * 도메인 라벨 상수 — DESIGN_RULES §9 기준.
 * constants.js의 statusLabels / resultLabels / receiptLabels 와 동일한 값.
 */
export const LABELS = {
  status: {
    ready: '대기',
    later: '임시저장',
    done: '참여함',
    skipped: '제외',
  },
  result: {
    unknown: '결과 미확인',
    won: '당첨',
    lost: '미당첨',
  },
  receipt: {
    unclaimed: '미수령',
    requested: '수령요청',
    received: '수령완료',
  },
};
