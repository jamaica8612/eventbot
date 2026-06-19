/* ============================================================
   당첨노트 v2 — 어댑터
   현재 앱 event(enrichEvent 출력) ↔ 프로토타입 ev 형태 변환,
   그리고 프로토타입 액션(actEvent/updateEvent) → useEventActions 분배.
   v2 화면은 update* 핸들러를 직접 호출하지 않고 이 어댑터만 사용한다.
   ============================================================ */
import { getPrizeDisplay, hasCrawledBody, buildUserContentLines } from '../../utils/eventModel.js';
import { parsePrizeAmount } from '../../utils/format.js';
import { toYMD, ymdToIso } from './domain.js';
import type {
  Ev,
  EvReceive,
  EvResult,
  EvStatus,
  EventModel,
  EventStatus,
  ReceiptStatus,
  ResultStatus,
} from './types.ts';

/* ---- 상태 매핑 (현재 ↔ 프로토타입) ---- */
const STATUS_TO_EV: Record<EventStatus, EvStatus> = { ready: 'waiting', later: 'draft', done: 'entered', skipped: 'excluded' };
const RESULT_TO_EV: Record<ResultStatus, EvResult> = { unknown: 'pending', won: 'win', lost: 'lose' };
const RESULT_FROM_EV: Record<EvResult, ResultStatus> = { pending: 'unknown', win: 'won', lose: 'lost' };
const RECEIVE_TO_EV: Record<ReceiptStatus, EvReceive> = { unclaimed: 'none', requested: 'requested', received: 'done' };
const RECEIVE_FROM_EV: Record<EvReceive, ReceiptStatus> = { none: 'unclaimed', requested: 'requested', done: 'received' };

/* ---- 플랫폼 정규화 (한글 보정 플랫폼 → youtube|naver|home|원문) ---- */
export function mapPlatform(event: EventModel): string {
  const p = `${event.platform || ''} ${event.source || ''}`;
  if (/youtube|유튜브|유튭/i.test(p)) return 'youtube';
  if (/naver|네이버|블로그/i.test(p)) return 'naver';
  if (/슈퍼투데이|슈투|superto|home|홈페이지/i.test(p)) return 'home';
  return event.platform || '기타';
}

const DEADLINE_ISO = (ymd?: string | null): string | null => ymdToIso(ymd, 23, 59);
const ANNOUNCE_ISO = (ymd?: string | null): string | null => ymdToIso(ymd, 18, 0);

/* ---- toEv: 현재 event → 프로토타입 ev ---- */
export function toEv(event: EventModel): Ev {
  const lines: string[] = buildUserContentLines(event);
  return {
    id: event.id,
    platform: mapPlatform(event),
    status: STATUS_TO_EV[event.status] || 'waiting',
    title: event.title || event.originalTitle || '(제목 없음)',
    winners: numberOr(event.totalWinnerCount ?? event.raw?.totalWinnerCount, 0),
    savedCount: numberOr(event.bookmarkCount, 0),

    // 대기/마감/임시 카드
    deadline: DEADLINE_ISO(event.deadlineDate),
    deadlineText: event.deadlineText || event.due || '',
    prizeSummary: getPrizeDisplay(event),
    body: lines.join('\n'),
    bodyLines: lines,
    bodyBlocked: !hasCrawledBody(event),
    link: event.originalUrl || event.url || '',
    applyUrl: event.applyUrl || event.applyTargetUrl || event.originalUrl || event.url || '',
    note: event.memo || '',
    collectedAt: event.lastSeenAt || event.createdAt || event.crawledAt || '',

    // 응모함(entered)
    enteredAt: event.participatedAt || null,
    announceDate: ANNOUNCE_ISO(event.resultAnnouncementDate),
    announceText: event.resultAnnouncementText || '',
    result: (event.resultStatus && RESULT_TO_EV[event.resultStatus]) || 'pending',
    prizeName: event.prizeTitle || '',
    prizeAmount: parsePrizeAmount(event.prizeAmount),
    receiveStatus: (event.receiptStatus && RECEIVE_TO_EV[event.receiptStatus]) || 'none',
    // 응모함 edit 패널의 "메모"는 발표 메모(resultAnnouncementText)에 매핑
    memo: event.resultAnnouncementText || '',
    winningMemo: event.winningMemo || '',

    _event: event,
  };
}

function numberOr(v: unknown, fallback: number): number {
  return Number.isFinite(v as number) ? (v as number) : fallback;
}

/* ============================================================
   액션 어댑터 — useEventActions 결과를 받아 프로토타입 핸들러로 노출
   ============================================================ */
type ListAction = 'enter' | 'draft' | 'exclude' | 'toWaiting';

interface EventActions {
  updateStatus(id: string, status: EventStatus): void;
  deleteInboxEvent(id: string): void;
  updateResult(id: string, result: ResultStatus): void;
  updateWinningMeta(id: string, meta: Record<string, unknown>): void;
  updateAnnouncement(id: string, meta: Record<string, unknown>): void;
  updateDeadline(id: string, meta: Record<string, unknown>): void;
}

export function makeEventActions(actions: EventActions) {
  // 카드(대기/마감/임시/검색)용: toWaiting → ready 복귀
  function actList(id: string, action: ListAction): void {
    if (action === 'enter') actions.updateStatus(id, 'done');
    else if (action === 'draft') actions.updateStatus(id, 'later');
    else if (action === 'exclude') actions.updateStatus(id, 'skipped');
    else if (action === 'toWaiting') actions.updateStatus(id, 'ready');
  }

  // 응모함용: toWaiting → 응모기록 초기화(deleteInboxEvent)
  function actInbox(id: string, action: ListAction): void {
    if (action === 'toWaiting') actions.deleteInboxEvent(id);
    else actList(id, action);
  }

  // updateEvent(id, patch) → 키별 분배. patch는 보통 단일 키.
  function dispatchUpdate(id: string, patch?: Partial<Ev>): void {
    if (!patch) return;
    if ('result' in patch) {
      actions.updateResult(id, RESULT_FROM_EV[patch.result as EvResult] || 'unknown');
    }
    if ('receiveStatus' in patch) {
      // win일 때만 UI 노출되므로 updateWinningMeta(resultStatus='won' 강제) 무해
      actions.updateWinningMeta(id, { receiptStatus: RECEIVE_FROM_EV[patch.receiveStatus as EvReceive] || 'unclaimed' });
    }
    if ('announceDate' in patch) {
      actions.updateAnnouncement(id, { resultAnnouncementDate: toYMD(patch.announceDate) });
    }
    if ('memo' in patch) {
      // 발표 메모 → resultAnnouncementText (updateAnnouncement는 resultStatus 보존)
      actions.updateAnnouncement(id, { resultAnnouncementText: patch.memo });
    }
    if ('prizeName' in patch) {
      actions.updateWinningMeta(id, { prizeTitle: patch.prizeName });
    }
    if ('prizeAmount' in patch) {
      actions.updateWinningMeta(id, { prizeAmount: String(patch.prizeAmount ?? '') });
    }
    if ('deadline' in patch) {
      actions.updateDeadline(id, { deadlineDate: toYMD(patch.deadline), deadlineText: patch.deadlineText });
    }
    if ('winningMemo' in patch) {
      actions.updateWinningMeta(id, { winningMemo: patch.winningMemo });
    }
  }

  return { actList, actInbox, dispatchUpdate };
}
