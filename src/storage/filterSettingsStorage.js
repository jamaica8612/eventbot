const FILTER_SETTINGS_KEY = 'event-click-filter-settings';

export const defaultFilterSettings = {
  nowScore: 70,
  homeScore: 40,
  excludedKeywords: [],
  hiddenPlatforms: [],
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
  const nowScore = clampNumber(settings?.nowScore, 0, 100, defaultFilterSettings.nowScore);
  const homeScore = clampNumber(
    settings?.homeScore,
    0,
    nowScore,
    Math.min(defaultFilterSettings.homeScore, nowScore),
  );

  return {
    nowScore,
    homeScore,
    excludedKeywords: normalizeStringList(settings?.excludedKeywords),
    hiddenPlatforms: normalizeStringList(settings?.hiddenPlatforms),
  };
}

export function parseKeywordInput(value) {
  return normalizeStringList(String(value ?? '').split(/[\n,]/));
}

function normalizeStringList(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
