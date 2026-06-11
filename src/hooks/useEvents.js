import { useEffect, useState } from 'react';
import { loadSupabaseEvents } from '../storage/supabaseEventStorage.js';
import { enrichEvent } from '../utils/eventModel.js';

async function loadRemoteEvents() {
  return await loadSupabaseEvents();
}

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    loadRemoteEvents()
      .then((remoteEvents) => {
        if (!isMounted) return;
        setEvents(remoteEvents.map(enrichEvent));
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err.message || '이벤트를 불러오지 못했습니다.');
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { events, setEvents, isLoading, loadError };
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('dn_theme')
      || window.localStorage.getItem('eventbotTheme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('dn_theme', theme);
  }, [theme]);

  return [theme, setTheme];
}
