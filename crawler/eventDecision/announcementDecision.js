export function analyzeAnnouncementByRules(eventInput = {}) {
  const text = buildAnnouncementText(eventInput);
  const announcementLine = findAnnouncementLine(text);
  const prizeText = eventInput.prizeText || extractPrizeText(text);

  if (!announcementLine) {
    return {
      resultAnnouncementDate: eventInput.resultAnnouncementDate ?? '',
      resultAnnouncementText: eventInput.resultAnnouncementText ?? '',
      prizeText,
    };
  }

  return {
    resultAnnouncementDate:
      eventInput.resultAnnouncementDate || extractAnnouncementDate(announcementLine),
    resultAnnouncementText:
      eventInput.resultAnnouncementText || announcementLine.slice(0, 100),
    prizeText,
  };
}

function buildAnnouncementText({
  title = '',
  dueText = '',
  deadlineText = '',
  memo = '',
  bodyText = '',
  originalText = '',
  originalLines = [],
  bodyLines = [],
} = {}) {
  return [
    title,
    dueText,
    deadlineText,
    memo,
    bodyText,
    originalText,
    Array.isArray(originalLines) ? originalLines.join('\n') : '',
    Array.isArray(bodyLines) ? bodyLines.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function findAnnouncementLine(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return (
    lines.find((line) => /당첨자?\s*발표|발표\s*일|결과\s*발표|당첨\s*확인/i.test(line)) ??
    ''
  );
}

function extractAnnouncementDate(text) {
  const today = new Date();
  const year = today.getFullYear();
  const normalizedText = text.replace(/\s+/g, ' ');
  const fullDateMatch = normalizedText.match(
    /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/,
  );

  if (fullDateMatch) {
    return formatInputDate(
      Number(fullDateMatch[1]),
      Number(fullDateMatch[2]),
      Number(fullDateMatch[3]),
    );
  }

  const monthDayMatch = normalizedText.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?/);
  if (monthDayMatch) {
    return formatInputDate(year, Number(monthDayMatch[1]), Number(monthDayMatch[2]));
  }

  return '';
}

function extractPrizeText(text) {
  const labeledMatch = text.match(
    /(?:경품|상품|혜택|리워드|선물)\s*[:：]?\s*([^\n]{2,60})/,
  );
  if (labeledMatch) {
    return labeledMatch[1].trim().slice(0, 40);
  }

  const keywordMatch = text.match(
    /(스타벅스|커피|상품권|네이버페이|포인트|치킨|편의점|쿠폰|기프티콘|아이패드|갤럭시|백화점)[^,\]\n]*/,
  );
  return keywordMatch ? keywordMatch[0].trim().slice(0, 40) : '';
}

function formatInputDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}
