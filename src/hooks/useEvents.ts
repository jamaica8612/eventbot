import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { initialEvents } from '../data/events.js';
import { loadCrawledEvents } from '../storage/crawledEventStorage.js';
import { applyStoredStatuses } from '../storage/eventStatusStorage.js';
import { applyExcludedStatus } from '../storage/excludedEventStorage.js';
import { hasSupabaseConfig, loadSupabaseEvents } from '../storage/supabaseEventStorage.js';
import { enrichEvent } from '../utils/eventModel.js';
import type { EventModel } from '../v2/lib/types.ts';

export type Theme = 'light' | 'dark';

async function loadRemoteEvents(): Promise<EventModel[]> {
  if (hasSupabaseConfig) {
    const supabaseEvents = await loadSupabaseEvents();
    if (supabaseEvents.length > 0) {
      return supabaseEvents;
    }
  }
  const crawledEvents = await loadCrawledEvents();
  return applyStoredStatuses(crawledEvents);
}

export function useEvents(initialRemoteEvents: EventModel[] | null = null): {
  events: EventModel[];
  setEvents: Dispatch<SetStateAction<EventModel[]>>;
  isLoading: boolean;
} {
  const [events, setEvents] = useState<EventModel[]>(() => (
    Array.isArray(initialRemoteEvents) ? initialRemoteEvents.map(enrichEvent) : []
  ));
  const [isLoading, setIsLoading] = useState<boolean>(() => !Array.isArray(initialRemoteEvents));

  useEffect(() => {
    if (Array.isArray(initialRemoteEvents)) {
      setEvents(initialRemoteEvents.map(enrichEvent));
      setIsLoading(false);
      return undefined;
    }
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
  }, [initialRemoteEvents]);

  return { events, setEvents, isLoading };
}

export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
  const [theme, setTheme] = useState<Theme>(() => {
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
