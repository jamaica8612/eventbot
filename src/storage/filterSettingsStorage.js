const FILTER_SETTINGS_KEY = 'event-click-filter-settings';

export const defaultFilterSettings = {
  excludedKeywords: [],
  hiddenPlatforms: [],
  hideExpiredReadyEvents: true,
};

export function loadFilterSettings() {
  if (typeof window === 'undefined') return defaultFilterSettings;

  try {
    return normalizeFilterSettings(
      JSON.parse(window.localStorage.getItem(FILTER_SETTINGS_KEY) || '{}'),
    );
  } catch {
    return defaultFilterSettings;
  }
}

export function saveFilterSettings(settings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    FILTER_SETTINGS_KEY,
    JSON.stringify(normalizeFilterSettings(settings)),
  );
}

export function normalizeFilterSettings(settings) {
  return {
    excludedKeywords: normalizeStringList(settings?.excludedKeywords),
    hiddenPlatforms: normalizeStringList(settings?.hiddenPlatforms),
    hideExpiredReadyEvents: settings?.hideExpiredReadyEvents !== false,
  };
}

export function parseKeywordInput(value) {
  return normalizeStringList(String(value ?? '').split(/[\n,]/));
}

function normalizeStringList(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}
