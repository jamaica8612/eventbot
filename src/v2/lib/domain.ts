/* ============================================================
   당첨노트 v2 — UI 도메인 헬퍼 (라벨/tone/표시 포맷)
   계산·정렬·판정은 현재 앱 모델(eventModel/deadlineModel/format)을 재사용하고,
   여기서는 UI가 기대하는 {label, tone, priority} 표시 형태만 만든다.
   날짜/금액 표기는 프로토타입 util.js 표기를 따른다(현재 format과 표기차로 이식).
   ============================================================ */
import { getUpcomingDeadlineMatch } from '../../utils/deadlineModel.js';
import { getAnnouncementStatus } from '../../utils/eventModel.js';
import { getLocalToday, parseLocalDate } from '../../utils/format.js';
import type { Ev, EventModel } from './types.ts';

export type Tone = 'urgent' | 'warn' | 'win' | 'lose' | 'info' | 'muted' | 'accent';

interface PlatformMeta {
  label: string;
  short: string;
  c: string;
  weak: string;
}

interface DeadlineMeta {
  key: string;
  label: string;
  tone: Tone;
  diffDays: number;
}

interface AnnounceMeta {
  key: string;
  label: string;
  tone: Tone;
  priority: number;
}

// 어댑터 toEv가 동봉한 원본 이벤트를 꺼낸다(없으면 ev 그대로).
function src(ev?: Ev | EventModel | null): EventModel {
  return ((ev as Ev | null)?._event) || (ev as EventModel) || ({} as EventModel);
}

/* ---- 플랫폼 배지 메타 (자기완결, 프로토타입 util.js 이식) ---- */
export function platformMeta(p?: string): PlatformMeta {
  const table: Record<string, PlatformMeta> = {
    youtube: { label: 'YouTube', short: 'YT', c: 'var(--yt)', weak: 'var(--yt-weak)' },
    naver: { label: '네이버', short: 'N', c: 'var(--naver)', weak: 'var(--naver-weak)' },
    home: { label: '슈퍼투데이', short: '슈', c: 'var(--home)', weak: 'var(--home-weak)' },
  };
  return (
    (p && table[p]) || { label: p || '기타', short: '?', c: 'var(--text-3)', weak: 'var(--surface-3)' }
  );
}

/* ---- 날짜 포맷 ---- */
const pad = (n: number): string => String(n).padStart(2, '0');
export function fmtMD(iso?: string | null): string {
  if (!iso) return '';
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getMonth() + 1}/${x.getDate()}`;
}
export function fmtFull(iso?: string | null): string {
  if (!iso) return '';
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}.${pad(x.getMonth() + 1)}.${pad(x.getDate())}`;
}

/* ---- 마감 칩 라벨 + tone (현재 deadlineModel 래핑: 텍스트 휴리스틱 유지) ---- */
export function deadlineMeta(ev?: Ev | EventModel): DeadlineMeta {
  const m = getUpcomingDeadlineMatch(src(ev));
  let tone: Tone;
  let key: string = m.bucket;
  if (m.diffDays < 0) {
    tone = 'lose';
    key = 'passed';
  } else if (m.bucket === 'today') {
    tone = 'urgent';
  } else if (m.bucket === 'tomorrow' || m.bucket === 'week') {
    tone = 'warn';
  } else {
    tone = 'muted'; // later / unknown
  }
  return { key, label: m.label, tone, diffDays: m.diffDays };
}

/* ---- 발표 상태 라벨 + tone + priority (현재 getAnnouncementStatus 래핑) ---- */
const ANNOUNCE_TONE: Record<string, { tone: Tone; priority: number }> = {
  unknown: { tone: 'muted', priority: 3 },
  overdue: { tone: 'urgent', priority: 0 },
  today: { tone: 'warn', priority: 1 },
  future: { tone: 'info', priority: 2 },
};
export function announceMeta(ev?: Ev | EventModel): AnnounceMeta {
  const s = getAnnouncementStatus(src(ev));
  const t = ANNOUNCE_TONE[s.state] || ANNOUNCE_TONE.unknown;
  return { key: s.state, label: s.label, tone: t.tone, priority: t.priority };
}

/* ---- 금액 표기 (프로토타입 util.js 이식) ---- */
export function won(n?: number): string {
  return (n || 0).toLocaleString('ko-KR') + '원';
}
export function wonShort(n?: number): string {
  if (!n) return '0원';
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    const rest = n % 10000;
    return rest ? `${man}만 ${rest.toLocaleString()}원` : `${man}만원`;
  }
  return n.toLocaleString() + '원';
}

/* ---- ISO ↔ 로컬 YYYY-MM-DD ---- */
export function toYMD(iso?: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// YYYY-MM-DD → 그날 18:00(KST) ISO (발표) / 23:59(KST) ISO (마감)
export function ymdToIso(ymd?: string | null, hour = 18, minute = 0): string | null {
  if (!ymd) return null;
  const d = parseLocalDate(ymd);
  if (!d) return null;
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export { getLocalToday };
