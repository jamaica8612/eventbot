import { useEffect, useState } from 'react';
import { initialEvents } from '../data/events.js';
import { loadCrawledEvents } from '../storage/crawledEventStorage.js';
import { applyStoredStatuses } from '../storage/eventStatusStorage.js';
import { applyExcludedStatus } from '../storage/excludedEventStorage.js';
import { hasSupabaseConfig, loadSupabaseEvents } from '../storage/supabaseEventStorage.js';
import { enrichEvent } from '../utils/eventModel.js';

async function loadRemoteEvents() {
  if (hasSupabaseConfig) {
    try {
      const supabaseEvents = await loadSupabaseEvents();
      if (supabaseEvents.length > 0) {
        return supabaseEvents;
      }
    } catch (error) {
      console.warn('Supabase events load failed. Falling back to bundled events.', error);
    }
  }
  const crawledEvents = await loadCrawledEvents();
  return applyStoredStatuses(crawledEvents);
}

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    loadRemoteEvents()
      .then((remoteEvents) => {
        if (!isMounted) return;
        const nextEvents =
          remoteEvents.length > 0 ? remoteEvents : applyStoredStatuses(initialEvents);
        const normalizedEvents = hasSupabaseConfig
          ? nextEvents
          : nextEvents.map(applyExcludedStatus);
        setEvents(normalizedEvents.map(enrichEvent));
      })
      .catch((error) => {
        console.warn('Event load failed. Using initial events.', error);
        if (isMounted) setEvents(applyStoredStatuses(initialEvents).map(enrichEvent));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { events, setEvents, isLoading };
}

const defaultAppearance = {
  design: 'v1',
};

function normalizeAppearance(value = {}) {
  const requestedMode = value.mode === 'light' || value.mode === 'dark' ? value.mode : null;
  const design = requestedMode ? (requestedMode === 'dark' ? 'v1' : 'v2') : value.design;
  const normalizedDesign = design === 'v2' ? 'v2' : 'v1';
  return {
    design: normalizedDesign,
    mode: normalizedDesign === 'v1' ? 'dark' : 'light',
  };
}

function loadStoredAppearance() {
  if (typeof window === 'undefined') return defaultAppearance;

  const storedDesign = window.localStorage.getItem('eventbotDesignVersion');
  const storedMode = window.localStorage.getItem('eventbotColorMode');

  if (storedDesign || storedMode) {
    return normalizeAppearance({ design: storedDesign, mode: storedMode });
  }

  const legacyTheme = window.localStorage.getItem('eventbotTheme');
  return normalizeAppearance({
    design: defaultAppearance.design,
    mode: legacyTheme,
  });
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(loadStoredAppearance);

  useEffect(() => {
    const nextAppearance = normalizeAppearance(appearance);
    document.documentElement.dataset.design = nextAppearance.design;
    document.documentElement.dataset.theme = nextAppearance.mode;
    document.body.dataset.design = nextAppearance.design;
    document.body.dataset.theme = nextAppearance.mode;
    window.localStorage.setItem('eventbotDesignVersion', nextAppearance.design);
    window.localStorage.setItem('eventbotColorMode', nextAppearance.mode);
  }, [appearance]);

  function updateAppearance(nextValue) {
    setAppearance((current) =>
      normalizeAppearance(
        typeof nextValue === 'function' ? nextValue(normalizeAppearance(current)) : nextValue,
      ),
    );
  }

  return [normalizeAppearance(appearance), updateAppearance];
}

export function useTheme() {
  const [appearance, setAppearance] = useAppearance();
  return [
    appearance.mode,
    (nextMode) =>
      setAppearance((current) => ({
        ...current,
        mode: typeof nextMode === 'function' ? nextMode(current.mode) : nextMode,
      })),
  ];
}
