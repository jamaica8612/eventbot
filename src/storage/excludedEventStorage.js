const EXCLUDED_EVENTS_KEY = 'event-click-excluded-events';

export function saveExcludedEvent(event) {
  if (typeof window === 'undefined' || !event) return;

  const excludedMap = readExcludedMap();
  for (const key of buildExcludedKeys(event)) {
    excludedMap[key] = {
      title: event.title,
      excludedAt: new Date().toISOString(),
    };
  }
  writeExcludedMap(excludedMap);
}

export function isExcludedEvent(event) {
  const excludedMap = readExcludedMap();
  return buildExcludedKeys(event).some((key) => Boolean(excludedMap[key]));
}

export function applyExcludedStatus(event) {
  if (!isExcludedEvent(event)) return event;
  return {
    ...event,
    status: 'skipped',
  };
}

function readExcludedMap() {
  if (typeof window === 'undefined') return {};

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(EXCLUDED_EVENTS_KEY) || '{}');
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
}

function writeExcludedMap(excludedMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EXCLUDED_EVENTS_KEY, JSON.stringify(excludedMap));
}

function buildExcludedKeys(event) {
  return [
    event.id,
    event.sourceEventId ? `source:${event.sourceEventId}` : '',
    event.originalUrl ? `url:${event.originalUrl}` : '',
    event.url ? `url:${event.url}` : '',
    event.title ? `title:${normalizeKey(event.title)}` : '',
  ].filter(Boolean);
}

function normalizeKey(value) {
  return String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');
}
