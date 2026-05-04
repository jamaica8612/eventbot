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

  return (
    lines.find(
      (line) =>
        /당첨자?\s*발표|발표\s*일|결과\s*발표|당첨\s*확인|수상작\s*발표/i.test(line) &&
        /(20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}|\d{1,2}\s*[.\-/월]\s*\d{1,2})/.test(line),
    ) ??
    lines.find((line) => /당첨자?\s*발표\s*일|발표\s*일/i.test(line)) ??
    lines.find((line) => /당첨자?\s*발표|결과\s*발표|당첨\s*확인|수상작\s*발표/i.test(line)) ??
    ''
  );
}

function extractAnnouncementDate(text) {
  return extractKoreanEventDate(text);
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
