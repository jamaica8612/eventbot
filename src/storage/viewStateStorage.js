const STORAGE_KEY = 'eventbotViewState';

const defaultViewState = {
  filter: 'ready',
  platformFilter: 'all',
  sortMode: 'default',
  deadlineFilter: 'all',
  inboxFilter: 'check',
  searchQuery: '',
  searchScope: 'all',
};

const allowedValues = {
  filter: new Set(['ready', 'todayDeadline', 'later', 'search', 'inbox', 'admin', 'skipped']),
  platformFilter: null,
  sortMode: new Set(['default', 'popular', 'winners', 'deadline', 'newest']),
  deadlineFilter: new Set(['all', 'today', 'tomorrow', 'week', 'unknown']),
  inboxFilter: new Set(['all', 'check', 'won', 'unreceived', 'lost']),
  searchQuery: null,
  searchScope: new Set(['all', 'ready', 'done', 'won']),
};

export function loadViewState() {
  if (typeof window === 'undefined') return defaultViewState;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return normalizeViewState(parsed);
  } catch {
    return defaultViewState;
  }
}

export function saveViewState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeViewState(state)));
}

export function normalizeViewState(state = {}) {
  const nextState = { ...defaultViewState };

  for (const [key, defaultValue] of Object.entries(defaultViewState)) {
    const value = state[key];
    if (typeof value !== 'string') continue;
    const allowed = allowedValues[key];
    nextState[key] = allowed && !allowed.has(value) ? defaultValue : value;
  }

  return nextState;
}
