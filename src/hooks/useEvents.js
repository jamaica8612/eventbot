import { useEffect, useState } from 'react';
import { initialEvents } from '../data/events.js';
import { loadCrawledEvents } from '../storage/crawledEventStorage.js';
import { applyStoredStatuses } from '../storage/eventStatusStorage.js';
import { applyExcludedStatus } from '../storage/excludedEventStorage.js';
import { hasSupabaseConfig, loadSupabaseEvents } from '../storage/supabaseEventStorage.js';
import { enrichEvent } from '../utils/eventModel.js';

async function loadRemoteEvents() {
  if (hasSupabaseConfig) {
    const supabaseEvents = await loadSupabaseEvents();
    if (supabaseEvents.length > 0) {
      return supabaseEvents;
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
    loadRemoteEvents().then((remoteEvents) => {
      if (!isMounted) return;
      const nextEvents =
        remoteEvents.length > 0 ? remoteEvents : applyStoredStatuses(initialEvents);
      const normalizedEvents = hasSupabaseConfig
        ? nextEvents
        : nextEvents.map(applyExcludedStatus);
      setEvents(normalizedEvents.map(enrichEvent));
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return { events, setEvents, isLoading };
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    if (window.localStorage.getItem('eventbotDesignRefresh') !== '2026-light') {
      window.localStorage.setItem('eventbotDesignRefresh', '2026-light');
      window.localStorage.setItem('eventbotTheme', 'light');
      return 'light';
    }
    const storedTheme = window.localStorage.getItem('eventbotTheme');
    return storedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem('eventbotTheme', theme);
  }, [theme]);

  return [theme, setTheme];
}
