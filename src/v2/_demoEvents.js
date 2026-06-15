/* ============================================================
   당첨노트 v2 — dev 데모 이벤트 (?demo 전용)
   다양한 상태(대기/임시/응모함 당첨·미수령·미당첨)를 한 번에 검증하기 위한 mock.
   ※ 단계 8(실제 전환)에서 DEMO_MODE와 함께 제거.
   ============================================================ */
const now = new Date();
const nowIso = now.toISOString();
const pad = (n) => String(n).padStart(2, '0');
function ymd(offsetDays) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const DEMO_EVENTS = [
  // 대기
  {
    id: 'd-ready-1', title: '[테크리뷰] 갤럭시 Z 폴드7 출시 기념 댓글 이벤트 — 본체 증정',
    platform: '유튜브 이벤트', status: 'ready', deadlineDate: ymd(0), bookmarkCount: 482, rank: 1,
    prizeText: '갤럭시 Z 폴드7 1대 외 2명', originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    applyTargetUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    originalLines: ['구독 + 좋아요 + 이 영상에 응모 댓글을 남겨주세요!', '조건: 1) 채널 구독 2) 영상 좋아요 3) "폴드7 갖고싶어요 + 이유" 댓글', '추첨을 통해 갤럭시 Z 폴드7 1대(3명 중 1명), 스마트태그 2개를 드립니다.'],
  },
  {
    id: 'd-ready-2', title: '여름맞이 무신사 스토어 블로그 체험단 모집 (스타벅스 5만원권)',
    platform: '네이버', status: 'ready', deadlineDate: ymd(1), bookmarkCount: 211,
    prizeText: '스타벅스 5만원권 50명', originalUrl: 'https://blog.naver.com/demo',
    originalLines: ['블로그에 무신사 여름 컬렉션 후기를 작성해주세요.', '추첨 50명에게 스타벅스 e카드 5만원권 증정.'],
  },
  {
    id: 'd-ready-3', title: '슈퍼투데이 회원 감사제 — 신세계상품권 룰렛 이벤트',
    platform: '슈퍼투데이', status: 'ready', deadlineText: '상세 확인 필요', bookmarkCount: 96,
    prizeText: '신세계상품권 1만원~50만원', originalUrl: 'https://www.suto.co.kr/demo',
  },
  // 임시저장
  {
    id: 'd-later-1', title: '신상 출시 기념 응모 — 다이슨 에어랩 멀티스타일러',
    platform: '슈퍼투데이', status: 'later', deadlineDate: ymd(6), bookmarkCount: 658,
    prizeText: '다이슨 에어랩 5명',
  },
  // 응모함 — 결과 미확인 (오늘 발표)
  {
    id: 'd-inbox-1', title: '독서모임 추천 이벤트 — 발표일 오늘',
    platform: '네이버', status: 'done', resultStatus: 'unknown', resultAnnouncementDate: ymd(0),
    participatedAt: nowIso, prizeText: '교보문고 1만원 15명',
  },
  // 응모함 — 결과 미확인 (발표일 지남)
  {
    id: 'd-inbox-2', title: '신용카드 리뷰 작성 이벤트 — 발표일 지남',
    platform: '네이버', status: 'done', resultStatus: 'unknown', resultAnnouncementDate: ymd(-2),
    participatedAt: nowIso, prizeText: '네이버페이 5천원 200명',
  },
  // 응모함 — 당첨 / 미수령
  {
    id: 'd-inbox-3', title: '[먹방] 신상 편의점 털기 — 기프티콘 뿌리기 이벤트',
    platform: '유튜브 이벤트', status: 'done', resultStatus: 'won', receiptStatus: 'unclaimed',
    prizeTitle: 'GS25 모바일 상품권', prizeAmount: '10000', resultAnnouncementDate: ymd(-1), participatedAt: nowIso,
  },
  // 응모함 — 당첨 / 수령요청
  {
    id: 'd-inbox-4', title: '뷰티 채널 신제품 — 당첨, 수령 요청함',
    platform: '유튜브 이벤트', status: 'done', resultStatus: 'won', receiptStatus: 'requested',
    prizeTitle: '올리브영 기프티콘', prizeAmount: '30000', resultAnnouncementDate: ymd(-3), participatedAt: nowIso,
  },
  // 응모함 — 당첨 / 수령완료
  {
    id: 'd-inbox-5', title: '쇼핑몰 리뷰왕 선정 — 당첨금 수령 완료',
    platform: '슈퍼투데이', status: 'done', resultStatus: 'won', receiptStatus: 'received',
    prizeTitle: '백화점 상품권', prizeAmount: '150000', resultAnnouncementDate: ymd(-10), participatedAt: nowIso,
  },
  // 응모함 — 미당첨
  {
    id: 'd-inbox-6', title: '카페 신메뉴 출시 이벤트 — 미당첨',
    platform: '네이버', status: 'done', resultStatus: 'lost', resultAnnouncementDate: ymd(-5), participatedAt: nowIso,
  },
];
