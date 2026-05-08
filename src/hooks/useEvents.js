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
      setEvents(nextEvents.map(applyExcludedStatus).map(enrichEvent));
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
    if (typeof window === 'undefined') return 'dark';
    const storedTheme = window.localStorage.getItem('eventbotTheme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem('eventbotTheme', theme);
  }, [theme]);

  return [theme, setTheme];
}
