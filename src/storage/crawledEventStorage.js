export async function loadCrawledEvents() {
  try {
    const response = await fetch('/crawled-events.json', { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.events)) {
      return [];
    }

    return payload.events.filter(isValidCrawledEvent);
  } catch {
    return [];
  }
}

function isValidCrawledEvent(event) {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.source === 'string' &&
    typeof event.due === 'string' &&
    typeof event.memo === 'string' &&
    typeof event.effort === 'string' &&
    typeof event.effortLabel === 'string' &&
    typeof event.status === 'string'
  );
}
