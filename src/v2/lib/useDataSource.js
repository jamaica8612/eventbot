/* ============================================================
   useDataSource — v2 데이터 소스 자동 결정
   - 세션 있음 → 'live': Supabase에서 fetch, 액션 시 동기화
   - 세션 없음 → 'demo': mock + localStorage (기존 동작 유지)
   - 인증 설정 자체가 없으면 → 항상 'demo'
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadSupabaseEvents, updateSupabaseEventState,
} from '../../storage/supabaseEventStorage.js';
import {
  hasAuthConfig, getCurrentSession, onAuthStateChange,
  signInWithGoogle, signOut, onAuthRequired,
} from '../../storage/supabaseAuthStorage.js';
import {
  enqueueSyncPatch, readSyncQueue, writeSyncQueue, markSyncAttempt,
} from '../../storage/syncQueueStorage.js';
import {
  loadPatches, savePatches, mergeSeedsWithPatches, diffToPatches,
  loadCreated, saveCreated,
} from './eventStore.js';

const MODE = {
  LOADING: 'loading',
  DEMO:    'demo',
  LIVE:    'live',
};

function loadDemo(seeds) {
  const patches = loadPatches();
  const created = loadCreated();
  return [...mergeSeedsWithPatches(seeds, patches), ...created];
}

function persistDemo(seeds, events) {
  const seedIds = new Set(seeds.map((s) => s.id));
  const seedView = events.filter((e) => seedIds.has(e.id));
  const created  = events.filter((e) => !seedIds.has(e.id));
  savePatches(diffToPatches(seeds, seedView));
  saveCreated(created);
}

export function useDataSource(seeds) {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState(hasAuthConfig ? MODE.LOADING : MODE.DEMO);
  const [events, setEvents] = useState(() => loadDemo(seeds));
  const [liveError, setLiveError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const seedsRef = useRef(seeds);

  /* 세션 초기 로드 + 구독 */
  useEffect(() => {
    if (!hasAuthConfig) return;
    let active = true;
    getCurrentSession()
      .then((s) => { if (!active) return; setSession(s); setMode(s ? MODE.LIVE : MODE.DEMO); })
      .catch(() => { if (!active) return; setMode(MODE.DEMO); });
    const unsub = onAuthStateChange((s) => {
      setSession(s);
      setMode(s ? MODE.LIVE : MODE.DEMO);
    });
    const unsubAuth = onAuthRequired(() => {
      // 토큰 만료/401 → demo로 fallback (사용자가 다시 로그인할 수 있게)
      setSession(null);
      setMode(MODE.DEMO);
    });
    return () => { active = false; unsub?.(); unsubAuth?.(); };
  }, []);

  /* live 진입 시 Supabase fetch */
  useEffect(() => {
    if (mode !== MODE.LIVE) return;
    let active = true;
    setIsFetching(true);
    setLiveError('');
    loadSupabaseEvents()
      .then((list) => { if (active) setEvents(list); })
      .catch((err) => {
        if (!active) return;
        setLiveError(err?.message || '이벤트 로드 실패');
      })
      .finally(() => { if (active) setIsFetching(false); });
    return () => { active = false; };
  }, [mode]);

  /* demo 모드 변경 → localStorage 영속화 */
  useEffect(() => {
    if (mode === MODE.DEMO) persistDemo(seedsRef.current, events);
  }, [events, mode]);

  /* 액션 동기화 통합 — 낙관적 업데이트 + 모드에 따른 동기화 */
  const updateEvent = useCallback((id, patch) => {
    if (!id || !patch) return;
    setEvents((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (mode === MODE.LIVE) {
      updateSupabaseEventState(id, patch).catch((err) => {
        console.warn('[v2] supabase sync failed, queueing for retry', err);
        enqueueSyncPatch(id, patch);
      });
    }
  }, [mode]);

  /* sync queue 재시도 — live 모드에서 실패한 patch를 온라인 복귀 + 10초 간격으로 flush */
  useEffect(() => {
    if (mode !== MODE.LIVE) return;
    let isRetrying = false;
    let active = true;

    async function flushQueue() {
      if (!active || isRetrying) return;
      const queue = readSyncQueue();
      if (queue.length === 0) return;
      isRetrying = true;

      const failedItems = [];
      for (const item of queue) {
        try {
          await updateSupabaseEventState(item.eventId, item.patch);
        } catch (error) {
          failedItems.push(markSyncAttempt(item, error?.message || 'unknown'));
        }
      }
      if (active) writeSyncQueue(failedItems);
      isRetrying = false;
    }

    flushQueue();
    window.addEventListener('online', flushQueue);
    const intervalId = window.setInterval(flushQueue, 10000);
    return () => {
      active = false;
      window.removeEventListener('online', flushQueue);
      window.clearInterval(intervalId);
    };
  }, [mode]);

  /* live 모드에서 수동 새로고침 */
  const refresh = useCallback(() => {
    if (mode !== MODE.LIVE) return;
    setIsFetching(true);
    setLiveError('');
    loadSupabaseEvents()
      .then((list) => setEvents(list))
      .catch((err) => setLiveError(err?.message || '이벤트 로드 실패'))
      .finally(() => setIsFetching(false));
  }, [mode]);

  /* 새 이벤트 추가 — demo만 가능 (Supabase에 createEvent 엔드포인트 없음) */
  const addEvent = useCallback((event) => {
    setEvents((cur) => [event, ...cur]);
  }, []);

  const auth = useMemo(() => ({
    hasConfig: hasAuthConfig,
    session,
    signIn: signInWithGoogle,
    signOut,
  }), [session]);

  return {
    events, setEvents,
    mode, isFetching, liveError,
    updateEvent, refresh, addEvent,
    auth,
  };
}
