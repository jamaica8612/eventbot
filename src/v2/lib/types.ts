/* ============================================================
   당첨노트 — 이벤트 데이터 모델 타입
   레거시 도메인/저장 레이어가 다루는 event(enrichEvent 출력) 형태와
   v2 화면이 쓰는 ev 형태를 모두 정의한다. JS 호출부와의 호환을 위해
   대부분의 필드는 optional로 둔다.
   ============================================================ */

/* ---- 도메인 enum (현재 모델 측 값) ---- */
export type EventStatus = 'ready' | 'later' | 'done' | 'skipped';
export type ResultStatus = 'unknown' | 'won' | 'lost';
export type ReceiptStatus = 'unclaimed' | 'requested' | 'received';

/* ---- 크롤러가 채우는 원본 보강 데이터(raw bag) ---- */
export interface EventRaw {
  title?: string;
  originalTitle?: string;
  platform?: string;
  source?: string;
  url?: string;
  originalUrl?: string;
  applyUrl?: string;
  applyTargetUrl?: string;
  prizeText?: string;
  originalText?: string;
  contentText?: string;
  bodyText?: string;
  detailText?: string;
  originalLines?: string[];
  contentLines?: string[];
  bodyLines?: string[];
  detailMetaLines?: string[];
  externalLinks?: string[];
  totalWinnerCount?: number;
  [key: string]: unknown;
}

/* ---- 현재 앱 이벤트(enrichEvent 출력) ---- */
export interface EventModel {
  id: string;
  status: EventStatus;
  title?: string;
  originalTitle?: string;
  platform?: string;
  source?: string;

  // 마감
  deadlineDate?: string | null;
  deadlineText?: string;
  due?: string;

  // 링크/메타
  url?: string;
  originalUrl?: string;
  applyUrl?: string;
  applyTargetUrl?: string;
  externalLinks?: string[];
  bookmarkCount?: number;
  rank?: number;
  totalWinnerCount?: number;
  memo?: string;

  // 본문
  originalText?: string;
  originalLines?: string[];

  // 경품
  prizeText?: string;
  prizeTitle?: string;
  prizeAmount?: string | number;
  decisionReason?: string;

  // 결과/발표/수령
  resultStatus?: ResultStatus;
  receiptStatus?: ReceiptStatus;
  resultAnnouncementDate?: string | null;
  resultAnnouncementText?: string;
  winningMemo?: string;

  // 타임스탬프
  participatedAt?: string | null;
  resultCheckedAt?: string | null;
  lastSeenAt?: string;
  createdAt?: string;
  crawledAt?: string;

  raw?: EventRaw;
  [key: string]: unknown;
}

/* ---- 필터 설정 (화면/스토리지 공유) ---- */
export interface FilterSettings {
  hideExpiredReadyEvents?: boolean;
  hiddenPlatforms?: string[];
  excludedKeywords?: string[];
}

/* ---- v2 화면이 쓰는 프로토타입 ev 형태 (toEv 출력) ---- */
export type EvStatus = 'waiting' | 'draft' | 'entered' | 'excluded';
export type EvResult = 'pending' | 'win' | 'lose';
export type EvReceive = 'none' | 'requested' | 'done';

export interface Ev {
  id: string;
  platform: string;
  status: EvStatus;
  title: string;
  winners: number;
  savedCount: number;
  deadline: string | null;
  deadlineText: string;
  prizeSummary: string;
  body: string;
  bodyLines: string[];
  bodyBlocked: boolean;
  link: string;
  applyUrl: string;
  note: string;
  collectedAt: string;
  enteredAt: string | null;
  announceDate: string | null;
  announceText: string;
  result: EvResult;
  prizeName: string;
  prizeAmount: number;
  receiveStatus: EvReceive;
  memo: string;
  winningMemo: string;
  _event: EventModel;
}
