const STORAGE_KEY = 'event-click-status-map';
const validStatuses = new Set(['ready', 'later', 'done', 'skipped']);
const validResultStatuses = new Set(['unknown', 'won', 'lost']);
const validReceiptStatuses = new Set(['unclaimed', 'requested', 'received']);

export function applyStoredStatuses(events) {
  const stateMap = readStateMap();

  return events.map((event) => {
    const savedState = stateMap[event.id];

    return {
      ...event,
      status: savedState?.status ?? event.status,
      resultStatus: savedState?.resultStatus ?? event.resultStatus ?? 'unknown',
      participatedAt: savedState?.participatedAt ?? event.participatedAt ?? null,
      resultCheckedAt: savedState?.resultCheckedAt ?? event.resultCheckedAt ?? null,
      resultAnnouncementDate:
        savedState?.resultAnnouncementDate ?? event.resultAnnouncementDate ?? '',
      resultAnnouncementText:
        savedState?.resultAnnouncementText ?? event.resultAnnouncementText ?? '',
      prizeTitle: savedState?.prizeTitle ?? event.prizeTitle ?? event.prizeText ?? '',
      prizeAmount: savedState?.prizeAmount ?? event.prizeAmount ?? '',
      receiptStatus: savedState?.receiptStatus ?? event.receiptStatus ?? 'unclaimed',
      winningMemo: savedState?.winningMemo ?? event.winningMemo ?? '',
    };
  });
}

export function saveEventAnnouncement(eventId, meta) {
  const stateMap = readStateMap();
  const currentState = stateMap[eventId] ?? {};
  const nextState = {
    ...currentState,
    status: 'done',
    resultStatus: currentState.resultStatus ?? 'unknown',
    participatedAt: currentState.participatedAt ?? new Date().toISOString(),
  };

  if (typeof meta.resultAnnouncementDate === 'string') {
    nextState.resultAnnouncementDate = meta.resultAnnouncementDate;
  }

  if (typeof meta.resultAnnouncementText === 'string') {
    nextState.resultAnnouncementText = meta.resultAnnouncementText;
  }

  stateMap[eventId] = nextState;
  writeStateMap(stateMap);
}

export function saveEventStatus(eventId, status) {
  if (!validStatuses.has(status)) {
    return;
  }

  const stateMap = readStateMap();
  const currentState = stateMap[eventId] ?? {};
  const nextState = {
    ...currentState,
    status,
  };

  if (status === 'done') {
    nextState.resultStatus = currentState.resultStatus ?? 'unknown';
    nextState.participatedAt = currentState.participatedAt ?? new Date().toISOString();
  }

  if (status !== 'done') {
    nextState.resultStatus = 'unknown';
    nextState.resultCheckedAt = null;
  }

  stateMap[eventId] = nextState;
  writeStateMap(stateMap);
}

export function saveEventResult(eventId, resultStatus) {
  if (!validResultStatuses.has(resultStatus)) {
    return;
  }

  const stateMap = readStateMap();
  const currentState = stateMap[eventId] ?? {};
  stateMap[eventId] = {
    ...currentState,
    status: 'done',
    resultStatus,
    participatedAt: currentState.participatedAt ?? new Date().toISOString(),
    resultCheckedAt: new Date().toISOString(),
    receiptStatus: currentState.receiptStatus ?? 'unclaimed',
  };
  writeStateMap(stateMap);
}

export function saveWinningMeta(eventId, meta) {
  const stateMap = readStateMap();
  const currentState = stateMap[eventId] ?? {};
  const nextState = {
    ...currentState,
    status: 'done',
    resultStatus: 'won',
  };

  if (typeof meta.prizeAmount === 'string') {
    nextState.prizeAmount = meta.prizeAmount.replace(/[^\d]/g, '');
  }

  if (typeof meta.prizeTitle === 'string') {
    nextState.prizeTitle = meta.prizeTitle;
  }

  if (typeof meta.winningMemo === 'string') {
    nextState.winningMemo = meta.winningMemo;
  }

  if (validReceiptStatuses.has(meta.receiptStatus)) {
    nextState.receiptStatus = meta.receiptStatus;
  }

  stateMap[eventId] = nextState;
  writeStateMap(stateMap);
}

function readStateMap() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};

    if (!parsedValue || typeof parsedValue !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedValue)
        .map(([eventId, value]) => [eventId, normalizeSavedState(value)])
        .filter(([, value]) => value),
    );
  } catch {
    return {};
  }
}

function normalizeSavedState(value) {
  if (typeof value === 'string' && validStatuses.has(value)) {
    return {
      status: value,
      resultStatus: 'unknown',
      participatedAt: null,
      resultCheckedAt: null,
      resultAnnouncementDate: '',
      resultAnnouncementText: '',
      prizeTitle: '',
      prizeAmount: '',
      receiptStatus: 'unclaimed',
      winningMemo: '',
    };
  }

  if (!value || typeof value !== 'object' || !validStatuses.has(value.status)) {
    return null;
  }

  return {
    status: value.status,
    resultStatus: validResultStatuses.has(value.resultStatus)
      ? value.resultStatus
      : 'unknown',
    participatedAt:
      typeof value.participatedAt === 'string' ? value.participatedAt : null,
    resultCheckedAt:
      typeof value.resultCheckedAt === 'string' ? value.resultCheckedAt : null,
    resultAnnouncementDate:
      typeof value.resultAnnouncementDate === 'string' ? value.resultAnnouncementDate : '',
    resultAnnouncementText:
      typeof value.resultAnnouncementText === 'string' ? value.resultAnnouncementText : '',
    prizeTitle: typeof value.prizeTitle === 'string' ? value.prizeTitle : '',
    prizeAmount: typeof value.prizeAmount === 'string' ? value.prizeAmount : '',
    receiptStatus: validReceiptStatuses.has(value.receiptStatus)
      ? value.receiptStatus
      : 'unclaimed',
    winningMemo: typeof value.winningMemo === 'string' ? value.winningMemo : '',
  };
}

function writeStateMap(stateMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap));
}
