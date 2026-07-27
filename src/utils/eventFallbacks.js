const effortLabels = {
  quick: '현장 즉시',
  home: '집에서 처리',
  hard: '복잡함',
};

export function getFallbackDecision(event = {}) {
  const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const effort = event.effort ?? raw.effort ?? 'quick';
  const actionType = event.actionType ?? raw.actionType ?? (
    effort === 'quick' ? 'now' : effort === 'home' ? 'home' : 'skip'
  );
  const clickScore = Number.isFinite(event.clickScore)
    ? event.clickScore
    : Number.isFinite(raw.clickScore)
      ? raw.clickScore
      : effort === 'quick' ? 80 : effort === 'home' ? 55 : 25;
  const estimatedSeconds = Number.isFinite(event.estimatedSeconds)
    ? event.estimatedSeconds
    : Number.isFinite(raw.estimatedSeconds)
      ? raw.estimatedSeconds
      : effort === 'quick' ? 30 : effort === 'home' ? 180 : 300;
  const deadlineDate = event.deadlineDate ?? raw.deadlineDate ?? '';
  const deadlineText = event.deadlineText ?? raw.deadlineText ?? event.due ?? raw.due ?? deadlineDate ?? '상세 확인 필요';

  return {
    clickScore,
    actionType,
    estimatedSeconds,
    decisionReason: event.decisionReason ?? raw.decisionReason ?? event.memo ?? '',
    prizeText: event.prizeText ?? raw.prizeText ?? '',
    deadlineText,
    deadlineDate,
    effort,
    effortLabel: event.effortLabel ?? raw.effortLabel ?? effortLabels[effort] ?? '',
  };
}

export function analyzeAnnouncementByRules(event = {}) {
  const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const text = [
    event.title,
    event.dueText,
    event.deadlineText,
    event.memo,
    event.bodyText,
    event.originalText,
    raw.originalText,
    raw.contentText,
    raw.bodyText,
    ...(Array.isArray(event.originalLines) ? event.originalLines : []),
    ...(Array.isArray(raw.originalLines) ? raw.originalLines : []),
    ...(Array.isArray(raw.bodyLines) ? raw.bodyLines : []),
  ].filter(Boolean).join('\n');
  const line = text.split(/\n+/)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .find((value) => /당첨자?\s*발표|발표\s*일|발표\s*예정|결과\s*발표|당첨\s*안내/.test(value)) || '';

  return {
    resultAnnouncementDate: event.resultAnnouncementDate || raw.resultAnnouncementDate || extractDate(line),
    resultAnnouncementText: event.resultAnnouncementText || raw.resultAnnouncementText || line.slice(0, 100),
    prizeText: event.prizeText || raw.prizeText || '',
  };
}

function extractDate(value) {
  const text = String(value ?? '');
  const full = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  const short = text.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (!short) return '';
  const year = new Date().getFullYear();
  return `${year}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;
}
