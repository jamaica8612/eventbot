/* ============================================================
   useDataSource — v2 데이터 소스 자동 결정
   - 세션 있음 → 'live': Supabase에서 fetch, 액션 시 동기화
   - 세션 없음 → 'demo': mock + localStorage (기존 동작 유지)
   - 인증 설정 자체가 없으면 → 항상 'demo'
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadSupabaseEvents, updateSupabaseEventState, createSupabaseEvent,
} from '../../storage/supabaseEventStorage.js';
import {
  hasAuthConfig, getCurrentSession, onAuthStateChange,
  signInWithGoogle, signOut, onAuthRequired,
  getSupabaseClient,
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

  /* live 모드에서 수동/자동 새로고침. silent=true 면 spinner 토글 없이 무음 갱신. */
  const refresh = useCallback((options) => {
    if (mode !== MODE.LIVE) return;
    const silent = options && options.silent === true;
    if (!silent) setIsFetching(true);
    setLiveError('');
    loadSupabaseEvents()
      .then((list) => setEvents(list))
      .catch((err) => setLiveError(err?.message || '이벤트 로드 실패'))
      .finally(() => { if (!silent) setIsFetching(false); });
  }, [mode]);

  /* Supabase realtime 구독 — 다른 디바이스/세션 변경 자동 반영.
     - user_event_states: 본인 액션 결과 (RLS로 본인 row만 수신)
     - events: 새 이벤트 / 메타데이터 변경
     - 디바운스 800ms로 묶어서 refresh, 페이지 hidden 시 채널 해제. */
  useEffect(() => {
    if (mode !== MODE.LIVE) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let channel = null;
    let debounceId = null;

    function scheduleRefresh() {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        refresh({ silent: true });
      }, 800);
    }

    function subscribe() {
      if (channel) return;
      channel = supabase
        .channel('eventbot-v2-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_event_states' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, scheduleRefresh)
        .subscribe();
    }

    function unsubscribe() {
      if (!channel) return;
      supabase.removeChannel(channel);
      channel = null;
    }

    function onVisibility() {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        unsubscribe();
      } else {
        subscribe();
        refresh({ silent: true });
      }
    }

    subscribe();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (debounceId) window.clearTimeout(debounceId);
      unsubscribe();
    };
  }, [mode, refresh]);

  /* 새 이벤트 추가
     - demo: 로컬 상태에만 push (eventStore에서 영속화)
     - live: Edge Function createEvent 호출, 성공 시 서버에서 변환된 row 사용
     반환 Promise는 성공/실패를 호출자가 알 수 있게 한다. */
  const addEvent = useCallback(async (event) => {
    if (mode === MODE.LIVE) {
      try {
        const created = await createSupabaseEvent(event);
        if (created) setEvents((cur) => [created, ...cur]);
        return created;
      } catch (err) {
        setLiveError(err?.message || '새 이벤트 추가 실패');
        throw err;
      }
    }
    setEvents((cur) => [event, ...cur]);
    return event;
  }, [mode]);

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
