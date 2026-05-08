const SYNC_QUEUE_KEY = 'event-click-sync-queue';
export function enqueueSyncPatch(eventId, patch) {
  if (typeof window === 'undefined') return [];

  const queue = readSyncQueue();
  const existingIndex = queue.findIndex((item) => item.eventId === eventId);
  const now = new Date().toISOString();
  const nextItem = {
    id: `${eventId}-${Date.now()}`,
    eventId,
    patch,
    attempts: 0,
    lastError: '',
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];
    queue[existingIndex] = {
      ...existing,
      patch: { ...existing.patch, ...patch },
      updatedAt: now,
    };
  } else {
    queue.push(nextItem);
  }

  writeSyncQueue(queue);
  return queue;
}

export function readSyncQueue() {
  if (typeof window === 'undefined') return [];

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    return Array.isArray(parsedValue)
      ? parsedValue
          .map(normalizeQueueItem)
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function writeSyncQueue(queue) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function markSyncAttempt(item, errorMessage) {
  return {
    ...item,
    attempts: item.attempts + 1,
    lastError: errorMessage,
    updatedAt: new Date().toISOString(),
  };
}

export function getSyncQueueSummary() {
  const queue = readSyncQueue();
  return {
    pendingCount: queue.length,
    failedCount: queue.filter((item) => item.attempts > 0).length,
  };
}

function normalizeQueueItem(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.eventId !== 'string' || !value.patch || typeof value.patch !== 'object') {
    return null;
  }

  return {
    id: typeof value.id === 'string' ? value.id : `${value.eventId}-${Date.now()}`,
    eventId: value.eventId,
    patch: value.patch,
    attempts: Number.isFinite(value.attempts) ? value.attempts : 0,
    lastError: typeof value.lastError === 'string' ? value.lastError : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}
