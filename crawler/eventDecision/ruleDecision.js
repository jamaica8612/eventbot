const effortByActionType = {
  now: 'quick',
  home: 'home',
  skip: 'hard',
};

const effortLabelByActionType = {
  now: '지금 딸깍',
  home: '집에서 처리',
  skip: '제외 후보',
};

const positiveRules = [
  { words: ['클릭', '응모', '간단', '퀴즈'], score: 30, reason: '빠른 참여 키워드' },
  { words: ['홈페이지 이벤트', '공식 홈페이지'], score: 20, reason: '홈페이지 이벤트' },
  { words: ['앱 이벤트', '앱에서'], score: 15, reason: '앱 이벤트' },
  { words: ['오늘 마감', '금일 마감', '마감임박'], score: 25, reason: '마감 임박' },
  { words: ['내일 마감'], score: 15, reason: '내일 마감' },
  {
    words: ['스타벅스', '커피', '상품권', '네이버페이', '포인트', '치킨', '편의점', '쿠폰', '기프티콘'],
    score: 10,
    reason: '보상 키워드',
  },
];

const negativeRules = [
  { words: ['출석', '출첵', '매일 참여', '데일리'], score: -50, reason: '매일 반복 참여 필요' },
  { words: ['유튜브', '영상 시청', '구독'], score: -15, reason: '영상 확인 필요' },
  { words: ['정성 댓글', '센스 있는 이유', '이유까지 댓글'], score: -40, reason: '정성 댓글 필요' },
  { words: ['댓글', '댓글을 남겨', '댓글 이벤트'], score: -25, reason: '댓글 작성 필요' },
  { words: ['인스타그램', '인스타'], score: -25, reason: '인스타그램 처리 필요' },
  { words: ['팔로우'], score: -15, reason: '팔로우 필요' },
  { words: ['친구태그', '친구 태그', '태그', '리그램', '공유'], score: -30, reason: 'SNS 공유/태그 필요' },
  { words: ['설문', '조사', '만족도', '수요조사', '인식조사'], score: -45, reason: '설문 처리 필요' },
  { words: ['공모', '아이디어', '후기', '리뷰', '국민심사'], score: -50, reason: '글 작성/검토 필요' },
  { words: ['회원가입', '가입'], score: -40, reason: '회원가입 필요' },
];

export function analyzeEventByRules(eventInput) {
  const clickScore = calculateClickScore(eventInput);
  const actionType = inferActionType(clickScore);
  const estimatedSeconds = estimateSeconds({ ...eventInput, score: clickScore });
  const decisionReason = buildDecisionReason(eventInput, clickScore, actionType);
  const prizeText = extractPrizeText(eventInput);
  const deadlineText = eventInput.dueText ?? eventInput.deadlineText ?? eventInput.due ?? '상세 확인 필요';

  return {
    clickScore,
    actionType,
    estimatedSeconds,
    decisionReason,
    prizeText,
    deadlineText,
    effort: effortByActionType[actionType],
    effortLabel: effortLabelByActionType[actionType],
  };
}

export function calculateClickScore({
  title = '',
  platform = '',
  bookmarkCount,
  rank,
  dueText = '',
  deadlineText = '',
  bodyText = '',
  originalText = '',
  originalLines = [],
}) {
  const text = buildDecisionText({ title, platform, dueText, deadlineText, bodyText, originalText, originalLines });
  let score = 50;

  for (const rule of [...positiveRules, ...negativeRules]) {
    if (includesAny(text, rule.words)) {
      score += rule.score;
    }
  }

  if (Number.isFinite(bookmarkCount)) {
    score += Math.min(10, Math.floor(bookmarkCount / 20));
  }

  if (Number.isFinite(rank)) {
    score += Math.max(0, 8 - Math.floor((rank - 1) / 5));
  }

  return clamp(score, 0, 100);
}

export function inferActionType(score) {
  if (score >= 70) return 'now';
  if (score >= 40) return 'home';
  return 'skip';
}

export function estimateSeconds({ title = '', platform = '', bodyText = '', originalText = '', originalLines = [], score }) {
  const text = buildDecisionText({ title, platform, bodyText, originalText, originalLines });
  if (/설문|조사|공모|아이디어|후기|리뷰|회원가입|국민심사/.test(text)) {
    return 300;
  }
  if (/유튜브|영상 시청|댓글|인스타|팔로우|공유|리그램|태그/.test(text)) {
    return 180;
  }
  if (score >= 85) return 20;
  if (score >= 70) return 30;
  if (score >= 40) return 180;
  return 300;
}

export function buildDecisionReason(input, score, actionType) {
  const text = buildDecisionText(input);
  const matchedReasons = [...positiveRules, ...negativeRules]
    .filter((rule) => includesAny(text, rule.words))
    .map((rule) => rule.reason);
  const uniqueReasons = [...new Set(matchedReasons)].slice(0, 2);

  if (uniqueReasons.length > 0) {
    return uniqueReasons.join(' · ');
  }

  if (actionType === 'now') return `딸깍점수 ${score}점으로 현장 처리 후보입니다.`;
  if (actionType === 'home') return `딸깍점수 ${score}점으로 집에서 확인하는 편이 좋습니다.`;
  return `딸깍점수 ${score}점으로 제외 후보입니다.`;
}

export function getFallbackDecision(event) {
  const effort = event.effort ?? 'quick';
  const actionType =
    event.actionType ??
    (effort === 'quick' ? 'now' : effort === 'home' ? 'home' : 'skip');
  const clickScore =
    Number.isFinite(event.clickScore) ? event.clickScore : effort === 'quick' ? 80 : effort === 'home' ? 55 : 25;
  const estimatedSeconds =
    Number.isFinite(event.estimatedSeconds) ? event.estimatedSeconds : effort === 'quick' ? 30 : effort === 'home' ? 180 : 300;

  return {
    clickScore,
    actionType,
    estimatedSeconds,
    decisionReason: event.decisionReason ?? event.memo ?? '',
    prizeText: event.prizeText ?? '',
    deadlineText: event.deadlineText ?? event.due ?? '상세 확인 필요',
    effort: event.effort ?? effortByActionType[actionType],
    effortLabel: event.effortLabel ?? effortLabelByActionType[actionType],
  };
}

function buildDecisionText({
  title = '',
  platform = '',
  dueText = '',
  deadlineText = '',
  bodyText = '',
  originalText = '',
  originalLines = [],
} = {}) {
  return [
    title,
    platform,
    dueText,
    deadlineText,
    bodyText,
    originalText,
    Array.isArray(originalLines) ? originalLines.join(' ') : '',
  ].join(' ');
}

function extractPrizeText({ title = '', bodyText = '', originalText = '', originalLines = [], prizeText = '' }) {
  if (prizeText) return prizeText;

  const text = buildDecisionText({ title, bodyText, originalText, originalLines });
  const match = text.match(/(스타벅스|커피|상품권|네이버페이|포인트|치킨|편의점|쿠폰|기프티콘)[^,\]\n]*/);
  return match ? match[0].trim().slice(0, 32) : '';
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
