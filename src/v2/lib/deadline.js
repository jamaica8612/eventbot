/* ============================================================
   Deadline 계산 헬퍼
   - 입력: deadlineDate (YYYY-MM-DD), now (Date) — 데모에선 고정 "오늘"
   - 출력: { label, variant, daysLeft, isPast }
   - variant: 'danger' | 'warn' | 'brand' | 'outline' | 'past'
   ============================================================ */

const DAY_MS = 24 * 60 * 60 * 1000;
const KOR_MONTH_DAY = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

function toDateStart(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'string') {
    const m = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return null;
}

export function computeDeadlineMeta(deadlineDate, now = new Date()) {
  const d = toDateStart(deadlineDate);
  if (!d) return null;
  const today = toDateStart(now);
  const diffMs = d.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / DAY_MS);

  if (daysLeft < 0) {
    return { label: `마감 ${KOR_MONTH_DAY(d)} (종료)`, variant: 'past', daysLeft, isPast: true };
  }
  if (daysLeft === 0) {
    return { label: '오늘마감', variant: 'danger', daysLeft, isPast: false };
  }
  if (daysLeft === 1) {
    return { label: '내일마감', variant: 'warn', daysLeft, isPast: false };
  }
  if (daysLeft <= 3) {
    return { label: `${daysLeft}일 후 마감`, variant: 'warn', daysLeft, isPast: false };
  }
  if (daysLeft <= 7) {
    return { label: `${daysLeft}일 후 마감`, variant: 'brand', daysLeft, isPast: false };
  }
  return { label: `마감 ${KOR_MONTH_DAY(d)}`, variant: 'outline', daysLeft, isPast: false };
}

/* "오늘" 의 ISO 날짜 — 데모용 고정값을 환경 변수로 override 가능 */
export function getToday() {
  const fixed = import.meta.env?.VITE_V2_TODAY;
  if (fixed) {
    const m = String(fixed).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date();
}

export function todayISO(date = getToday()) {
  const d = toDateStart(date);
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
