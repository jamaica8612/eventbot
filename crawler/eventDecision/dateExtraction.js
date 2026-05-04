export function extractKoreanEventDate(text, { baseDate = new Date() } = {}) {
  return extractKoreanEventDates(text, { baseDate })[0] ?? '';
}

export function extractKoreanEventDates(text, { baseDate = new Date() } = {}) {
  const normalizedText = normalizeDateText(text);
  const dates = [];
  const fullDatePattern = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;

  for (const match of normalizedText.matchAll(fullDatePattern)) {
    const date = formatInputDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (date) {
      dates.push({ date, index: match.index ?? 0 });
    }
  }

  const textWithoutFullDates = normalizedText.replace(fullDatePattern, ' ');
  const monthDayPattern = /(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?/g;

  for (const match of textWithoutFullDates.matchAll(monthDayPattern)) {
    const date = formatInputDate(
      inferYear(Number(match[1]), baseDate),
      Number(match[1]),
      Number(match[2]),
    );
    if (date) {
      dates.push({ date, index: match.index ?? 0 });
    }
  }

  return dates.sort((first, second) => first.index - second.index).map((entry) => entry.date);
}

export function normalizeDateText(text) {
  return String(text ?? '')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferYear(month, baseDate) {
  const baseYear = baseDate.getFullYear();
  const baseMonth = baseDate.getMonth() + 1;

  if (baseMonth >= 11 && month <= 2) {
    return baseYear + 1;
  }
  if (baseMonth <= 2 && month >= 11) {
    return baseYear - 1;
  }
  return baseYear;
}

export function formatInputDate(year, month, day) {
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
