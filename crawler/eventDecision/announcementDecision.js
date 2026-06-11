import { extractKoreanEventDate } from './dateExtraction.js';

export function analyzeAnnouncementByRules(eventInput = {}) {
  const text = buildAnnouncementText(eventInput);
  const announcementLine = findAnnouncementLine(text);
  const prizeText = extractPrizeText(text) || eventInput.prizeText || '';

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
    .filter(Boolean)
    .filter((line) => !/앱으로|내 발표현황|최신인기|오늘발표|미입력/.test(line));
  const windows = lines.map((line, index) =>
    [line, lines[index + 1], lines[index + 2]].filter(Boolean).join(' '),
  );

  return (
    windows.find(
      (line) =>
        isAnnouncementLine(line) &&
        /(20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}|\d{1,2}\s*[.\-/월]\s*\d{1,2})/.test(line),
    ) ??
    windows.find(
      (line) =>
        /당첨자?\s*발표\s*일|발표\s*일|당첨\s*발표\s*일|발표\s*예정/i.test(line) &&
        /[:：]|공지|예정|추후|커뮤니티|개별|문자|홈페이지|발송/i.test(line),
    ) ??
    lines.find((line) => !isAnnouncementLabelOnly(line) && isAnnouncementLine(line)) ??
    ''
  );
}

function isAnnouncementLine(line) {
  return /당첨자?\s*발표|발표\s*일|발표\s*예정|결과\s*발표|당첨\s*확인|수상작\s*발표|선정자?\s*발표|당첨\s*안내/i.test(
    line,
  );
}

function isAnnouncementLabelOnly(line) {
  return /^(?:당첨자?\s*)?(?:발표\s*일|발표\s*예정|당첨\s*발표\s*일|당첨자\s*발표일)$/.test(line);
}

function extractAnnouncementDate(text) {
  const focusedText = getAnnouncementDateFocusedText(text);
  const focusedDate = extractKoreanEventDate(focusedText);
  if (focusedDate || focusedText !== String(text ?? '')) return focusedDate;
  return extractKoreanEventDate(text);
}

function getAnnouncementDateFocusedText(text) {
  const source = String(text ?? '');
  const patterns = [
    /당첨자?\s*발표\s*일?/i,
    /당첨\s*발표\s*일?/i,
    /결과\s*발표/i,
    /발표\s*예정/i,
    /발표\s*일/i,
    /수상작\s*발표/i,
    /선정자?\s*발표/i,
    /당첨\s*안내/i,
  ];
  const matches = patterns
    .map((pattern) => source.search(pattern))
    .filter((index) => index >= 0);
  if (matches.length === 0) return source;
  const start = Math.min(...matches);
  return source.slice(start, start + 120);
}

function extractPrizeText(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const labeledLine = lines.find(
    (line) =>
      /(?:경품|상품|혜택|리워드|선물)\s*[:：]|경품태그/.test(line) &&
      !/당첨자?\s*발표|결과\s*발표|발표\s*일|경품\s*발송|상품\s*발송/.test(line),
  );

  if (labeledLine) {
    return labeledLine
      .replace(/^.*?(?:경품|상품|혜택|리워드|선물)\s*[:：]\s*/, '')
      .replace(/^.*?경품태그\s*/, '')
      .trim()
      .slice(0, 50);
  }

  const benefitLine = lines.find(
    (line) =>
      /추첨|증정|드립니다|드려요|제공/.test(line) &&
      /(스타벅스|커피|상품권|네이버페이|포인트|치킨|편의점|쿠폰|기프티콘|아이패드|갤럭시|백화점)/.test(line),
  );
  if (benefitLine) {
    const keywordMatch = benefitLine.match(
      /(스타벅스|커피|상품권|네이버페이|포인트|치킨|편의점|쿠폰|기프티콘|아이패드|갤럭시|백화점)[^,\]\n]*/,
    );
    if (keywordMatch) {
      return keywordMatch[0].trim().slice(0, 50);
    }
  }

  const keywordMatch = lines
    .filter((line) => !/당첨자?\s*발표|결과\s*발표|발표\s*일|경품\s*발송|상품\s*발송/.test(line))
    .join('\n')
    .match(
      /(스타벅스|커피|상품권|네이버페이|포인트|치킨|편의점|쿠폰|기프티콘|아이패드|갤럭시|백화점)[^,\]\n]*/,
    );
  return keywordMatch ? keywordMatch[0].trim().slice(0, 50) : '';
}
