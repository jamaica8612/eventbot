import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './tokens.css';
import {
  AppShell, SideNav, TopBar, ListPanel, DetailPanel, BottomNav, useEscape,
} from './shell/AppShell.jsx';
import {
  Button, IconButton, Tag, Pill, Inline, Stack, Divider, Input,
} from './components/primitives.jsx';
import { EventCard } from './components/EventCard.jsx';
import { EventDetailContent } from './components/EventDetailContent.jsx';
import { PlatformChip } from './components/PlatformChip.jsx';
import { ResultEntry } from './components/ResultEntry.jsx';
import { InboxSummary } from './components/InboxSummary.jsx';
import { KeyboardHelp } from './components/KeyboardHelp.jsx';
import { NewEventDialog } from './components/NewEventDialog.jsx';
import {
  clearPatches, loadCreated, loadUiState, saveUiState,
  loadSearchHistory, pushSearchHistory, clearSearchHistory,
} from './lib/eventStore.js';
import { useDataSource } from './lib/useDataSource.js';
import { AuthBanner } from './components/AuthBanner.jsx';
import { computeDeadlineMeta, todayISO } from './lib/deadline.js';
import { getStoredTheme, setStoredTheme, applyTheme } from './lib/theme.js';

/* ============================================================
   Mock 이벤트 8건.
   status / resultStatus / receiptStatus 필드로 사이드 네비
   필터가 의미 있게 갈리도록 다양화.
   ============================================================ */
const MOCK_EVENTS = [
  {
    id: 'e1',
    title: '신라면 블랙 출시 기념 댓글 이벤트 — 1000명 추첨',
    platform: '인스타그램',
    status: 'ready', resultStatus: 'unknown',
    deadlineText: '오늘마감',
    deadlineDate: '2026-05-18',
    prizeText: '신라면 블랙 1박스 + 컵라면 세트',
    prizeAmount: '2만원',
    prizeAmountValue: 20000,
    totalWinnerCount: 1000,
    source: '@nongshim_kr',
    applyUrl: 'https://instagram.com/p/example1',
    originalUrl: 'https://instagram.com/p/example1',
    originalLines: [
      '신라면 블랙 신제품 출시 기념! 1,000분께 1박스 + 컵라면 세트 증정 🍜',
      '',
      '◆ 참여 방법',
      '1) @nongshim_kr 팔로우',
      '2) 게시물 좋아요 + 댓글로 친구 2명 태그',
      '3) 스토리에 공유하면 당첨 확률 2배 ✨',
      '',
      '◆ 응모 기간: 5/13 ~ 5/18 23:59',
      '◆ 결과 발표: 5/25 인스타그램 DM',
      '',
      '※ 비공개 계정은 자동 제외',
      '※ 국내 거주자만 응모 가능',
    ],
  },
  {
    id: 'e8',
    title: '편의점 도시락 신메뉴 댓글 이벤트',
    platform: '유튜브',
    status: 'ready', resultStatus: 'unknown',
    deadlineText: '오늘마감',
    deadlineDate: '2026-05-18',
    prizeText: 'CU 모바일 상품권 5천원권',
    prizeAmount: '5천원',
    prizeAmountValue: 5000,
    totalWinnerCount: 2000,
    source: 'CU공식',
    applyUrl: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
    originalUrl: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
    originalLines: [
      'CU 신메뉴 도시락 광고 영상을 보고 댓글 남기면 추첨으로 2,000명께 모바일 상품권 5천원권 증정!',
      '',
      '◆ 참여 방법',
      '1) 영상 좋아요 + 채널 구독',
      '2) 댓글로 가장 먹어보고 싶은 신메뉴 1개 + 이유',
      '',
      '◆ 응모: 5/14 ~ 5/18',
      '◆ 발표: 5/24 댓글 고정',
    ],
  },
  {
    id: 'e2',
    title: '갤럭시 S26 사전예약 응모 — 100명 추첨',
    platform: '카카오톡',
    status: 'ready', resultStatus: 'unknown',
    deadlineText: '내일마감',
    deadlineDate: '2026-05-19',
    prizeText: '갤럭시 S26 Ultra 256GB',
    prizeAmount: '180만원',
    prizeAmountValue: 1800000,
    totalWinnerCount: 100,
    source: '삼성전자',
    applyUrl: 'https://example.com/galaxy',
    originalUrl: 'https://example.com/galaxy',
    originalLines: [
      '갤럭시 S26 Ultra 사전예약 응모. 100분께 단말기 증정.',
      '카카오톡 채널 추가 후 응모 폼 작성.',
    ],
  },
  {
    id: 'e3',
    title: '스타벅스 신메뉴 시음 이벤트',
    platform: '유튜브',
    status: 'later', resultStatus: 'unknown',
    deadlineText: '5/22 마감',
    deadlineDate: '2026-05-22',
    prizeText: '스타벅스 e-기프트카드 3만원권',
    prizeAmount: '3만원',
    prizeAmountValue: 30000,
    totalWinnerCount: 500,
    source: '스타벅스코리아',
    applyUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    originalUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    originalLines: [
      '스타벅스 신메뉴 시음권 추첨!',
      '',
      '◆ 영상 시청 후 댓글로 가장 마셔보고 싶은 메뉴 + 한 줄 응원',
      '◆ 구독 + 좋아요 필수',
      '◆ 발표: 5/25 스타벅스코리아 공식 채널',
    ],
  },
  {
    id: 'e4',
    title: '여름맞이 다이슨 에어랩 증정 이벤트',
    platform: '인스타그램',
    status: 'later', resultStatus: 'unknown',
    deadlineText: '5/31 마감',
    deadlineDate: '2026-05-31',
    prizeText: '다이슨 에어랩 컴플리트',
    prizeAmount: '69만원',
    prizeAmountValue: 690000,
    totalWinnerCount: 3,
    source: '@beauty_kr',
    applyUrl: 'https://instagram.com/p/example4',
    originalUrl: 'https://instagram.com/p/example4',
    originalLines: [
      '다이슨 에어랩 컴플리트 3명 추첨.',
      '@beauty_kr 팔로우 + 게시물 좋아요 + 친구 1명 태그.',
      '발표 6/3',
    ],
  },
  {
    id: 'e5',
    title: '맥북 프로 M5 출시기념 응모 이벤트',
    platform: '인스타그램',
    status: 'done', resultStatus: 'won', receiptStatus: 'received',
    deadlineText: '4/30 종료',
    deadlineDate: '2026-04-30',
    resultAnnouncementDate: '2026-05-10',
    resultAnnouncementText: '결과발표 5월 10일',
    prizeText: '맥북 프로 14인치 M5',
    prizeAmount: '299만원',
    prizeAmountValue: 2990000,
    totalWinnerCount: 5,
    source: '@apple_kr',
    participatedAt: '2026-04-28',
    winningMemo: '5월 12일 수령 완료',
    applyUrl: 'https://instagram.com/p/example5',
    originalUrl: 'https://instagram.com/p/example5',
    originalLines: [
      '맥북 프로 14인치 M5 출시 기념 5명께 증정.',
      '게시물 좋아요 + 친구 1명 태그 + 스토리 공유.',
    ],
  },
  {
    id: 'e6',
    title: '봄맞이 백화점 상품권 추첨',
    platform: '카카오톡',
    status: 'done', resultStatus: 'won', receiptStatus: 'unclaimed',
    deadlineText: '5/5 종료',
    deadlineDate: '2026-05-05',
    resultAnnouncementText: '오늘 발표',
    prizeText: '신세계 상품권 10만원권',
    prizeAmount: '10만원',
    prizeAmountValue: 100000,
    totalWinnerCount: 50,
    source: '신세계백화점',
    participatedAt: '2026-05-03',
    applyUrl: 'https://example.com/voucher',
    originalUrl: 'https://example.com/voucher',
    originalLines: [
      '신세계 상품권 10만원권 50명 추첨.',
      '카톡 채널 추가 + 응모 폼 작성.',
    ],
  },
  {
    id: 'e7',
    title: '러닝화 신제품 체험단 모집',
    platform: '인스타그램',
    status: 'done', resultStatus: 'lost',
    deadlineText: '4/20 종료',
    deadlineDate: '2026-04-20',
    resultAnnouncementDate: '2026-05-01',
    prizeText: '나이키 페가수스 41',
    prizeAmount: '16만원',
    prizeAmountValue: 160000,
    totalWinnerCount: 30,
    source: '@nike_kr',
    participatedAt: '2026-04-15',
    applyUrl: 'https://instagram.com/p/example7',
    originalUrl: 'https://instagram.com/p/example7',
    originalLines: [
      '나이키 페가수스 41 체험단 30명 모집.',
      '제품 사진 + 1000자 후기 작성.',
    ],
  },
];

/* ============================================================
   Views — 사이드 네비 항목별 필터 정의
   ============================================================ */
// 데모 기준일. 실제 배포 시 new Date() 로 바꾸면 됨.
const DEMO_NOW = new Date(2026, 4, 18);
const TODAY = todayISO(DEMO_NOW);

const VIEWS = {
  inbox:    { icon: '📥', label: '받은함',   filter: (e) => e.status !== 'skipped',               title: '📥 받은함' },
  today:    { icon: '🔥', label: '오늘마감', filter: (e) => e.deadlineDate === TODAY && e.status !== 'skipped', title: '🔥 오늘마감' },
  ready:    { icon: '⏰', label: '응모대기', filter: (e) => e.status === 'ready',                 title: '⏰ 응모대기' },
  later:    { icon: '🔖', label: '임시저장', filter: (e) => e.status === 'later',                 title: '🔖 임시저장' },
  received: { icon: '📬', label: '수령함',   filter: (e) => e.status === 'done',                  title: '📬 수령함' },
  won:      { icon: '🏆', label: '당첨',     filter: (e) => e.resultStatus === 'won',             title: '🏆 당첨' },
  lost:     { icon: '❌', label: '미당첨',   filter: (e) => e.resultStatus === 'lost',            title: '❌ 미당첨' },
  skipped:  { icon: '🗑',  label: '제외함',  filter: (e) => e.status === 'skipped',              title: '🗑 제외함' },
};

/* 액션 → 상태 변경 매핑 */
const ACTION_TO_PATCH = {
  ready:    { status: 'ready' },
  complete: { status: 'done', resultStatus: 'unknown' },
  later:    { status: 'later' },
  skip:     { status: 'skipped' },
};
const ACTION_LABEL = {
  ready: '대기로 복원', complete: '참여완료', later: '임시저장', skip: '제외',
};

const PLATFORMS = {
  ig: { icon: '📷', label: '인스타그램', match: '인스타그램' },
  yt: { icon: '▶️', label: '유튜브',     match: '유튜브' },
  kk: { icon: '💬', label: '카카오톡',   match: '카카오톡' },
};

const PILLS = [
  { id: 'all',  label: '전체' },
  { id: 'unfinished', label: '미응모', filter: (e) => e.status !== 'done' },
  { id: 'yt',   label: '유튜브만', filter: (e) => e.platform === '유튜브' },
];

const SORTS = {
  default:  { label: '기본순',     sort: null },
  deadline: { label: '마감임박 ↑', sort: (a, b) => (a.deadlineDate || '9999').localeCompare(b.deadlineDate || '9999') },
  high:     { label: '고액 ↑',     sort: (a, b) => (b.prizeAmountValue ?? 0) - (a.prizeAmountValue ?? 0) },
  winners:  { label: '응모자 적은순', sort: (a, b) => (a.totalWinnerCount ?? 999999) - (b.totalWinnerCount ?? 999999) },
  recent:   { label: '최근 등록',  sort: (a, b) => b.id.localeCompare(a.id) },
};

/* Bottom nav 항목 → view 매핑 */
const BNAV_TO_VIEW = {
  home: 'today',
  inbox: 'received',
};

/* ============================================================
   AppDemo
   ============================================================ */
export default function AppDemo() {
  const {
    events, setEvents,
    mode, isFetching, liveError,
    updateEvent: dsUpdateEvent, refresh, addEvent,
    auth,
  } = useDataSource(MOCK_EVENTS);

  const [newOpen, setNewOpen] = useState(false);
  const handleAddEvent = async (newEvent) => {
    try {
      const created = await addEvent(newEvent);
      const target = created || newEvent;
      setNewOpen(false);
      setSelectedId(target.id);
      setSelectedView('inbox');
      setSelectedPlatform(null);
      setPillId('all');
      setSortId('default');
    } catch (err) {
      alert(err?.message || '새 이벤트 추가에 실패했습니다.');
    }
  };
  const initialUi = useMemo(() => loadUiState(), []);
  const [selectedView, setSelectedView] = useState(initialUi.view || 'today');
  const [selectedPlatform, setSelectedPlatform] = useState(initialUi.platform || null);
  const [pillId, setPillId] = useState(initialUi.pill || 'all');
  const [sortId, setSortId] = useState(initialUi.sort || 'default');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialUi.selectedId || 'e1');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toasts, setToasts] = useState([]); // [{id, action, eventId, prevPatch, ts}], 최근 5개만 유지
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => getStoredTheme());
  useEscape(() => { setSheetOpen(false); setHelpOpen(false); setDrawerOpen(false); setNewOpen(false); });

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveUiState({ view: selectedView, platform: selectedPlatform, pill: pillId, sort: sortId, selectedId });
  }, [selectedView, selectedPlatform, pillId, sortId, selectedId]);

  const visibleEvents = useMemo(() => {
    let list = events.filter(VIEWS[selectedView].filter);
    if (selectedPlatform) {
      list = list.filter((e) => e.platform === PLATFORMS[selectedPlatform].match);
    }
    const pill = PILLS.find((p) => p.id === pillId);
    if (pill?.filter) list = list.filter(pill.filter);
    const sort = SORTS[sortId]?.sort;
    if (sort) list = [...list].sort(sort);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => matchesQuery(e, q));
    return list;
  }, [events, selectedView, selectedPlatform, pillId, sortId, query]);

  // 선택된 이벤트가 현재 보이지 않으면 첫 항목으로 자동 이동
  const effectiveSelected = useMemo(() => {
    const found = visibleEvents.find((e) => e.id === selectedId);
    return found || visibleEvents[0] || events[0];
  }, [visibleEvents, selectedId, events]);

  const handleItemClick = (id) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 959px)').matches) setSheetOpen(true);
  };

  const handleViewChange = (viewId) => {
    setSelectedView(viewId);
    setSelectedPlatform(null);
    setPillId('all');
    setSortId('default');
    setQuery('');
    setDrawerOpen(false);
  };

  /* -------- 액션: 상태 변경 + 다음 카드로 자동 이동 + Undo 토스트 -------- */
  const applyAction = useCallback((eventId, action) => {
    const patch = ACTION_TO_PATCH[action];
    if (!patch || !eventId) return;
    const before = events.find((e) => e.id === eventId);
    if (!before) return;
    const prevPatch = { status: before.status, resultStatus: before.resultStatus };

    const idx = visibleEvents.findIndex((e) => e.id === eventId);
    const nextCandidate = visibleEvents[idx + 1] || visibleEvents[idx - 1];

    dsUpdateEvent(eventId, patch);
    if (nextCandidate && nextCandidate.id !== eventId) setSelectedId(nextCandidate.id);
    setSheetOpen(false);
    setToasts((prev) => {
      const next = [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, action, eventId, prevPatch, ts: Date.now() },
      ];
      return next.slice(-5);
    });
  }, [events, visibleEvents, dsUpdateEvent]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const undoToast = useCallback((id) => {
    setToasts((prev) => {
      const target = id ? prev.find((t) => t.id === id) : prev[prev.length - 1];
      if (target) {
        dsUpdateEvent(target.eventId, target.prevPatch);
        setSelectedId(target.eventId);
      }
      return prev.filter((t) => t.id !== (target?.id ?? id));
    });
  }, [dsUpdateEvent]);

  // 각 토스트 자동 소멸 (개별 4s)
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => {
      const remaining = Math.max(0, 4000 - (Date.now() - t.ts));
      return window.setTimeout(() => dismissToast(t.id), remaining);
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  const handleApply = useCallback(() => {
    const url = effectiveSelected?.applyUrl || effectiveSelected?.originalUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [effectiveSelected]);

  /* -------- 일반 필드 업데이트 (ResultEntry 등) -------- */
  const updateEvent = dsUpdateEvent;

  /* -------- 키보드 단축키 -------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'e') { e.preventDefault(); applyAction(effectiveSelected?.id, 'complete'); }
      else if (k === 'l') { e.preventDefault(); applyAction(effectiveSelected?.id, 'later'); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); applyAction(effectiveSelected?.id, 'skip');
      } else if (k === 'j' || k === 'arrowdown') {
        e.preventDefault();
        const i = visibleEvents.findIndex((ev) => ev.id === effectiveSelected?.id);
        const next = visibleEvents[Math.min(i + 1, visibleEvents.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (k === 'k' || k === 'arrowup') {
        e.preventDefault();
        const i = visibleEvents.findIndex((ev) => ev.id === effectiveSelected?.id);
        const prev = visibleEvents[Math.max(i - 1, 0)];
        if (prev) setSelectedId(prev.id);
      } else if (k === 'u' && toasts.length > 0) {
        e.preventDefault(); undoToast();
      } else if (e.key === '?' || (e.shiftKey && k === '/')) {
        e.preventDefault(); setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyAction, effectiveSelected, visibleEvents, toasts, undoToast]);

  /* -------- 네비 섹션 생성 (카운트 = 현재 events 기반, 재계산) -------- */
  const counts = useMemo(() => {
    const c = {};
    for (const [id, v] of Object.entries(VIEWS)) c[id] = events.filter(v.filter).length;
    for (const [id, p] of Object.entries(PLATFORMS)) c[`pf_${id}`] = events.filter((e) => e.platform === p.match).length;
    return c;
  }, [events]);

  const navSections = useMemo(() => [
    {
      title: '응모',
      items: [
        viewItem('inbox', counts, selectedView, handleViewChange),
        viewItem('today', counts, selectedView, handleViewChange),
        viewItem('ready', counts, selectedView, handleViewChange),
        viewItem('later', counts, selectedView, handleViewChange),
      ],
    },
    {
      title: '결과',
      items: [
        viewItem('received', counts, selectedView, handleViewChange),
        viewItem('won', counts, selectedView, handleViewChange),
        viewItem('lost', counts, selectedView, handleViewChange),
        viewItem('skipped', counts, selectedView, handleViewChange),
      ],
    },
    {
      title: '플랫폼',
      items: Object.entries(PLATFORMS).map(([pid, p]) => ({
        id: pid,
        icon: p.icon,
        label: p.label,
        count: counts[`pf_${pid}`],
        active: selectedPlatform === pid,
        onClick: () => setSelectedPlatform((cur) => (cur === pid ? null : pid)),
      })),
    },
  ], [selectedView, selectedPlatform, counts]);

  const handleResetPatches = () => {
    if (mode === 'live') {
      alert('실데이터 모드에선 초기화 기능을 쓸 수 없습니다. 로그아웃 후 데모 모드에서 사용.');
      return;
    }
    if (!window.confirm('저장된 상태(액션·결과·메모)를 초기화할까요? 직접 추가한 이벤트는 유지됩니다.')) return;
    clearPatches();
    setEvents([...MOCK_EVENTS, ...loadCreated()]);
    setToasts([]);
  };

  const nav = (
    <SideNav
      brand={{ name: 'EventBot', mark: 'v2' }}
      sections={navSections}
      user={{ initial: 'J', name: '정민', meta: '관리자', onReset: handleResetPatches }}
    />
  );

  const viewMeta = VIEWS[selectedView];
  const platformMeta = selectedPlatform ? PLATFORMS[selectedPlatform] : null;
  const listTitle = viewMeta.title;
  const listSub = `${visibleEvents.length}건${platformMeta ? ` · ${platformMeta.label}` : ''}`;

  const list = (
    <ListPanel topBar={
      <>
        <AuthBanner mode={mode} isFetching={isFetching} liveError={liveError} auth={auth} onRefresh={refresh} />
        <TopBar
          title={listTitle} sub={listSub}
          leftIcon={
            <IconButton
              className="v2-shell__hamburger"
              aria-label="메뉴 열기"
              onClick={() => setDrawerOpen(true)}
            >☰</IconButton>
          }
          actions={
            <>
              <IconButton aria-label="새 이벤트 추가" onClick={() => setNewOpen(true)} title="새 이벤트">＋</IconButton>
              <IconButton aria-label="새로고침" onClick={mode === 'live' ? refresh : undefined} disabled={isFetching}>↻</IconButton>
              <IconButton aria-label="필터">⚙</IconButton>
            </>
          }
        />
      </>
    }>
      <div style={{ padding: 'var(--sp-3)' }}>
        {['received', 'won', 'lost'].includes(selectedView) && (
          <InboxSummary events={events} />
        )}
        <SearchInput
          value={query}
          onChange={setQuery}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <Inline style={{ flexWrap: 'wrap' }}>
            {PILLS.map((p) => (
              <Pill key={p.id} on={pillId === p.id} onClick={() => setPillId(p.id)}>{p.label}</Pill>
            ))}
          </Inline>
          <select
            value={sortId}
            onChange={(e) => setSortId(e.target.value)}
            className="v2-select"
            aria-label="정렬"
          >
            {Object.entries(SORTS).map(([id, s]) => (
              <option key={id} value={id}>↕ {s.label}</option>
            ))}
          </select>
        </div>
        {visibleEvents.length === 0 ? (
          <EmptyState view={viewMeta.title} query={query} />
        ) : (
          <Stack size="sm">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                selected={event.id === effectiveSelected.id}
                onClick={() => handleItemClick(event.id)}
                onQuickAction={(action) => applyAction(event.id, action)}
                query={query}
                now={DEMO_NOW}
              />
            ))}
          </Stack>
        )}
      </div>
    </ListPanel>
  );

  const selectedMeta = computeDeadlineMeta(effectiveSelected?.deadlineDate, DEMO_NOW);
  const selectedDeadlineLabel = selectedMeta?.label ?? effectiveSelected?.deadlineText ?? '';
  const selectedDeadlineVariant = selectedMeta?.variant === 'past' ? 'outline' : (selectedMeta?.variant ?? 'outline');

  const detailHeader = effectiveSelected && (
    <Inline style={{ flexWrap: 'wrap' }}>
      <Tag variant={selectedDeadlineVariant}>{selectedDeadlineLabel}</Tag>
      <PlatformChip platform={effectiveSelected.platform} />
      {effectiveSelected.totalWinnerCount != null && (
        <Tag>{effectiveSelected.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>
      )}
      {effectiveSelected.resultStatus === 'won' && <Tag variant="success">🏆 당첨</Tag>}
      {effectiveSelected.resultStatus === 'lost' && <Tag variant="outline">미당첨</Tag>}
      {effectiveSelected.source && (
        <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)' }}>· {effectiveSelected.source}</span>
      )}
    </Inline>
  );

  const inLater   = effectiveSelected?.status === 'later';
  const inDone    = effectiveSelected?.status === 'done';
  const inSkipped = effectiveSelected?.status === 'skipped';

  const currentIdx = visibleEvents.findIndex((e) => e.id === effectiveSelected?.id);
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx >= 0 && currentIdx < visibleEvents.length - 1;
  const goPrev = () => { if (canGoPrev) setSelectedId(visibleEvents[currentIdx - 1].id); };
  const goNext = () => { if (canGoNext) setSelectedId(visibleEvents[currentIdx + 1].id); };

  const detail = (
    <DetailPanel topBar={
      <TopBar>
        <Inline>
          <Button variant="primary" onClick={handleApply}>참여하기 ↗</Button>
          <Button kbd="E" disabled={inDone} onClick={() => applyAction(effectiveSelected?.id, 'complete')}>참여완료</Button>
          <Button kbd="L" disabled={inLater} onClick={() => applyAction(effectiveSelected?.id, 'later')}>임시저장</Button>
          {inSkipped ? (
            <Button variant="ghost" onClick={() => applyAction(effectiveSelected?.id, 'ready')}>↩ 복원</Button>
          ) : (
            <Button variant="ghost" kbd="⌫" onClick={() => applyAction(effectiveSelected?.id, 'skip')}>제외</Button>
          )}
          <IconButton aria-label="이전" disabled={!canGoPrev} onClick={goPrev}>↑</IconButton>
          <IconButton aria-label="다음" disabled={!canGoNext} onClick={goNext}>↓</IconButton>
          <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)', marginLeft: 4 }}>
            {currentIdx >= 0 ? `${currentIdx + 1}/${visibleEvents.length}` : ''}
          </span>
        </Inline>
      </TopBar>
    }>
      {effectiveSelected ? (
        <Stack size="lg">
          {detailHeader}
          <h1 className="v2-h1">{effectiveSelected.title}</h1>
          <Divider />
          <ResultEntry event={effectiveSelected} onChange={updateEvent} />
          <EventDetailContent event={effectiveSelected} />
        </Stack>
      ) : (
        <div style={{ padding: 'var(--sp-7)', color: 'var(--c-text-mute)', textAlign: 'center' }}>
          {isFetching ? '이벤트 로드 중…' : '선택된 이벤트가 없습니다'}
        </div>
      )}
    </DetailPanel>
  );

  const focusSearch = () => {
    // 검색 input에 포커스. ListPanel 안의 input을 셀렉터로 찾는다.
    setTimeout(() => {
      document.querySelector('.v2-list-panel__body input')?.focus();
    }, 0);
  };

  const bnavItems = [
    {
      id: 'home', icon: '🏠', label: '홈',
      active: selectedView === 'today',
      onClick: () => handleViewChange('today'),
    },
    {
      id: 'search', icon: '🔍', label: '검색',
      active: false,
      onClick: focusSearch,
    },
    null,
    {
      id: 'inbox', icon: '📬', label: '수령함',
      active: ['received', 'won', 'lost'].includes(selectedView),
      dot: events.some((e) => e.resultStatus === 'won' && e.receiptStatus !== 'received'),
      onClick: () => handleViewChange('received'),
    },
    {
      id: 'me', icon: '👤', label: '나',
      onClick: () => {},
    },
  ];

  const bottomNav = (
    <BottomNav items={bnavItems} fab={{ icon: '＋', label: '새 이벤트', onClick: () => setNewOpen(true) }}/>
  );

  const sheet = sheetOpen && effectiveSelected && (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <Inline style={{ fontSize: 'var(--fs-xs)' }}>
          <PlatformChip platform={effectiveSelected.platform} />
          <span className="v2-muted">·</span>
          <span style={{ color: selectedDeadlineVariant === 'danger' ? 'var(--c-danger)' : 'var(--c-text-mid)' }}>
            {selectedDeadlineLabel}
          </span>
        </Inline>
        <Inline>
          <IconButton aria-label="이전" disabled={!canGoPrev} onClick={goPrev}>←</IconButton>
          <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            {currentIdx >= 0 ? `${currentIdx + 1}/${visibleEvents.length}` : ''}
          </span>
          <IconButton aria-label="다음" disabled={!canGoNext} onClick={goNext}>→</IconButton>
        </Inline>
      </div>
      <h2 className="v2-h2" style={{ marginBottom: 'var(--sp-3)' }}>{effectiveSelected.title}</h2>
      <Inline style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <Tag variant="brand">{effectiveSelected.prizeAmount}</Tag>
        {effectiveSelected.totalWinnerCount != null && (
          <Tag>{effectiveSelected.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>
        )}
      </Inline>
      <ResultEntry event={effectiveSelected} onChange={updateEvent} />
      <div style={{ marginTop: 'var(--sp-4)' }}>
        <EventDetailContent event={effectiveSelected} />
      </div>
      <Stack style={{ marginTop: 'var(--sp-5)' }}>
        <Button variant="primary" size="lg" block onClick={handleApply}>응모하러 가기 ↗</Button>
        <Button size="lg" block disabled={inDone}
          onClick={() => applyAction(effectiveSelected?.id, 'complete')}>✔ 참여완료</Button>
        <Button size="lg" block disabled={inLater}
          onClick={() => applyAction(effectiveSelected?.id, 'later')}>🔖 임시저장</Button>
        <Button variant="ghost" size="lg" block
          onClick={() => applyAction(effectiveSelected?.id, 'skip')}>제외</Button>
        <Button variant="ghost" size="lg" block onClick={() => setSheetOpen(false)}>닫기</Button>
      </Stack>
    </>
  );

  return (
    <>
      <ViewSwitcher onHelp={() => setHelpOpen(true)} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      <AppShell
        nav={nav}
        list={list}
        detail={detail}
        bottomNav={bottomNav}
        sheet={sheet}
        onSheetClose={() => setSheetOpen(false)}
        onSheetPrev={canGoPrev ? goPrev : undefined}
        onSheetNext={canGoNext ? goNext : undefined}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />
      <ActionToastStack toasts={toasts} onUndo={undoToast} onDismiss={dismissToast} />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <NewEventDialog open={newOpen} onClose={() => setNewOpen(false)} onSubmit={handleAddEvent} />
    </>
  );
}

/* ============================================================
   ActionToastStack — 여러 토스트를 아래에서 위로 쌓아 표시
   각 토스트는 4초 후 자동 소멸. U 키는 가장 최근 것 실행 취소.
   ============================================================ */
function ActionToastStack({ toasts, onUndo, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div
      className="v2"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--sp-5) + env(safe-area-inset-bottom, 0px) + 76px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column-reverse', // 새 것이 위로 쌓이게
        gap: 'var(--sp-2)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast, i) => (
        <ActionToast
          key={toast.id}
          toast={toast}
          isLatest={i === toasts.length - 1}
          onUndo={() => onUndo(toast.id)}
          onClose={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ActionToast({ toast, isLatest, onUndo, onClose }) {
  return (
    <div
      style={{
        background: 'var(--c-surface-3)',
        border: '1px solid var(--c-line-strong)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-3) var(--sp-4)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        maxWidth: 'min(440px, calc(100vw - 24px))',
        animation: 'v2-fade var(--dur-base) var(--ease-out)',
        opacity: isLatest ? 1 : 0.85,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text)' }}>
        ✓ {ACTION_LABEL[toast.action]} 처리됨
      </span>
      <button onClick={onUndo} className="v2-btn v2-btn--sm v2-btn--ghost"
        style={{ color: 'var(--c-brand)', minHeight: 28, padding: '0 10px' }}>
        실행 취소{isLatest && <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.7, marginLeft: 4 }}>U</span>}
      </button>
      <button onClick={onClose} className="v2-icon-btn v2-icon-btn--sm" aria-label="닫기">✕</button>
    </div>
  );
}

function viewItem(id, counts, selectedView, onChange) {
  const v = VIEWS[id];
  return {
    id, icon: v.icon, label: v.label,
    count: counts[id],
    active: selectedView === id,
    onClick: () => onChange(id),
  };
}

function matchesQuery(event, q) {
  if (!q) return true;
  const haystack = [
    event.title,
    event.platform,
    event.source,
    event.prizeText,
    event.prizeTitle,
    event.prizeAmount,
    ...(event.originalLines ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

/* ============================================================
   SearchInput — 최근 검색어 5개 드롭다운 포함
   ============================================================ */
function SearchInput({ value, onChange }) {
  const [history, setHistory] = useState(() => loadSearchHistory());
  const [focused, setFocused] = useState(false);
  const blurTimerRef = useRef(null);

  const commit = useCallback((term) => {
    const trimmed = (term ?? '').trim();
    if (!trimmed) return;
    setHistory(pushSearchHistory(trimmed));
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      commit(value);
    }
  };

  const onBlur = () => {
    // 드롭다운 클릭 처리될 시간 확보
    blurTimerRef.current = window.setTimeout(() => setFocused(false), 120);
    if (value && value.trim()) commit(value);
  };

  const handlePick = (term) => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    onChange(term);
    setHistory(pushSearchHistory(term));
    setFocused(false);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  const showDropdown = focused && history.length > 0 && !value;

  return (
    <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
      <span style={{ position: 'absolute', left: 14, top: 'calc(var(--input-height, 38px) / 2)', transform: 'translateY(-50%)', color: 'var(--c-text-faint)', pointerEvents: 'none' }}>🔎</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
          setFocused(true);
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="제목 / 본문 / 경품 / 출처 검색…"
        style={{ paddingLeft: 38, paddingRight: value ? 36 : 16 }}
      />
      {value && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => onChange('')}
          className="v2-icon-btn v2-icon-btn--sm"
          style={{ position: 'absolute', right: 6, top: 'calc(var(--input-height, 38px) / 2)', transform: 'translateY(-50%)' }}
        >✕</button>
      )}
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
            overflow: 'hidden',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--sp-2) var(--sp-3)',
            fontSize: 'var(--fs-xs)', color: 'var(--c-text-mute)',
            borderBottom: '1px solid var(--c-line)',
          }}>
            <span>최근 검색어</span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="v2-btn v2-btn--sm v2-btn--ghost"
              style={{ minHeight: 22, padding: '0 6px', fontSize: 'var(--fs-xs)' }}
            >전체 삭제</button>
          </div>
          {history.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => handlePick(term)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'transparent',
                border: 'none',
                color: 'var(--c-text)',
                fontSize: 'var(--fs-sm)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface-3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >🔎 {term}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ view, query }) {
  return (
    <div style={{
      padding: 'var(--sp-7) var(--sp-4)',
      textAlign: 'center',
      color: 'var(--c-text-mute)',
      fontSize: 'var(--fs-sm)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 'var(--sp-2)' }}>·</div>
      {query
        ? <div>"<b style={{ color: 'var(--c-text-mid)' }}>{query}</b>"에 일치하는 이벤트가 없어요</div>
        : <div>{view}에 해당하는 이벤트가 없어요</div>}
    </div>
  );
}

function ViewSwitcher({ onHelp, theme, onToggleTheme }) {
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 100,
      display: 'flex', gap: 4, padding: 4,
      background: theme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)',
    }}>
      <a href="/v2-shell.html" className="v2-pill v2-pill--on" style={{ textDecoration: 'none' }}>App</a>
      <a href="/v2.html" className="v2-pill" style={{ textDecoration: 'none' }}>Tokens</a>
      {onToggleTheme && (
        <button onClick={onToggleTheme} className="v2-pill" aria-label="테마 토글" title={`${theme === 'light' ? '다크' : '라이트'} 모드로`} style={{ border: 'none', cursor: 'pointer' }}>
          {theme === 'light' ? '☾' : '☀'}
        </button>
      )}
      {onHelp && (
        <button onClick={onHelp} className="v2-pill" aria-label="키보드 단축키 도움말" title="키보드 단축키 (?)" style={{ border: 'none', cursor: 'pointer' }}>?</button>
      )}
    </div>
  );
}
