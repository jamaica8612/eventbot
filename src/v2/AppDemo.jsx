import { useCallback, useEffect, useMemo, useState } from 'react';
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
const TODAY = '2026-05-18';

const VIEWS = {
  inbox:    { icon: '📥', label: '받은함',   filter: (e) => e.status !== 'skipped',               title: '📥 받은함' },
  today:    { icon: '🔥', label: '오늘마감', filter: (e) => e.deadlineDate === TODAY && e.status !== 'skipped', title: '🔥 오늘마감' },
  ready:    { icon: '⏰', label: '응모대기', filter: (e) => e.status === 'ready',                 title: '⏰ 응모대기' },
  later:    { icon: '🔖', label: '임시저장', filter: (e) => e.status === 'later',                 title: '🔖 임시저장' },
  received: { icon: '📬', label: '수령함',   filter: (e) => e.status === 'done',                  title: '📬 수령함' },
  won:      { icon: '🏆', label: '당첨',     filter: (e) => e.resultStatus === 'won',             title: '🏆 당첨' },
  lost:     { icon: '❌', label: '미당첨',   filter: (e) => e.resultStatus === 'lost',            title: '❌ 미당첨' },
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
  { id: 'high', label: '고액 ↑', sort: (a, b) => (b.prizeAmountValue ?? 0) - (a.prizeAmountValue ?? 0) },
  { id: 'yt',   label: '유튜브만', filter: (e) => e.platform === '유튜브' },
];

const BNAV_ITEMS = [
  { id: 'home', icon: '🏠', label: '홈', active: true },
  { id: 'search', icon: '🔍', label: '검색' },
  null,
  { id: 'inbox', icon: '📬', label: '수령함', dot: true },
  { id: 'me', icon: '👤', label: '나' },
];

/* ============================================================
   AppDemo
   ============================================================ */
export default function AppDemo() {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [selectedView, setSelectedView] = useState('today');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [pillId, setPillId] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('e1');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(null); // {action, eventId, prevPatch}
  useEscape(() => setSheetOpen(false));

  const visibleEvents = useMemo(() => {
    let list = events.filter(VIEWS[selectedView].filter);
    if (selectedPlatform) {
      list = list.filter((e) => e.platform === PLATFORMS[selectedPlatform].match);
    }
    const pill = PILLS.find((p) => p.id === pillId);
    if (pill?.filter) list = list.filter(pill.filter);
    if (pill?.sort)   list = [...list].sort(pill.sort);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => matchesQuery(e, q));
    return list;
  }, [events, selectedView, selectedPlatform, pillId, query]);

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
    setQuery('');
  };

  /* -------- 액션: 상태 변경 + 다음 카드로 자동 이동 + Undo 토스트 -------- */
  const applyAction = useCallback((eventId, action) => {
    const patch = ACTION_TO_PATCH[action];
    if (!patch || !eventId) return;
    const before = events.find((e) => e.id === eventId);
    if (!before) return;
    const prevPatch = { status: before.status, resultStatus: before.resultStatus };

    // 액션 전에 다음 선택 후보 계산 (현재 visibleEvents에서 이 항목을 제외했을 때 다음)
    const idx = visibleEvents.findIndex((e) => e.id === eventId);
    const nextCandidate = visibleEvents[idx + 1] || visibleEvents[idx - 1];

    setEvents((cur) => cur.map((e) => (e.id === eventId ? { ...e, ...patch } : e)));
    if (nextCandidate && nextCandidate.id !== eventId) setSelectedId(nextCandidate.id);
    setSheetOpen(false);
    setToast({ action, eventId, prevPatch, ts: Date.now() });
  }, [events, visibleEvents]);

  const undoToast = useCallback(() => {
    if (!toast) return;
    setEvents((cur) => cur.map((e) => (e.id === toast.eventId ? { ...e, ...toast.prevPatch } : e)));
    setSelectedId(toast.eventId);
    setToast(null);
  }, [toast]);

  // 토스트 자동 소멸 (4s)
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleApply = useCallback(() => {
    const url = effectiveSelected?.applyUrl || effectiveSelected?.originalUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [effectiveSelected]);

  /* -------- 일반 필드 업데이트 (ResultEntry 등) -------- */
  const updateEvent = useCallback((id, patch) => {
    if (!id || !patch) return;
    setEvents((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

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
      } else if (k === 'u' && toast) {
        e.preventDefault(); undoToast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyAction, effectiveSelected, visibleEvents, toast, undoToast]);

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

  const nav = (
    <SideNav
      brand={{ name: 'EventBot', mark: 'v2' }}
      sections={navSections}
      user={{ initial: 'J', name: '정민', meta: '관리자' }}
    />
  );

  const viewMeta = VIEWS[selectedView];
  const platformMeta = selectedPlatform ? PLATFORMS[selectedPlatform] : null;
  const listTitle = viewMeta.title;
  const listSub = `${visibleEvents.length}건${platformMeta ? ` · ${platformMeta.label}` : ''}`;

  const list = (
    <ListPanel topBar={
      <TopBar title={listTitle} sub={listSub} actions={
        <>
          <IconButton aria-label="새로고침">↻</IconButton>
          <IconButton aria-label="필터">⚙</IconButton>
        </>
      }/>
    }>
      <div style={{ padding: 'var(--sp-3)' }}>
        {['received', 'won', 'lost'].includes(selectedView) && (
          <InboxSummary events={events} />
        )}
        <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-faint)', pointerEvents: 'none' }}>🔎</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 / 본문 / 경품 / 출처 검색…"
            style={{ paddingLeft: 38, paddingRight: query ? 36 : 16 }}
          />
          {query && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => setQuery('')}
              className="v2-icon-btn v2-icon-btn--sm"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
            >✕</button>
          )}
        </div>
        <Inline style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
          {PILLS.map((p) => (
            <Pill key={p.id} on={pillId === p.id} onClick={() => setPillId(p.id)}>{p.label}</Pill>
          ))}
        </Inline>
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
              />
            ))}
          </Stack>
        )}
      </div>
    </ListPanel>
  );

  const detailHeader = (
    <Inline style={{ flexWrap: 'wrap' }}>
      <Tag variant="danger">{effectiveSelected.deadlineText}</Tag>
      <PlatformChip platform={effectiveSelected.platform} />
      {effectiveSelected.totalWinnerCount != null && (
        <Tag>{effectiveSelected.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>
      )}
      {effectiveSelected.resultStatus === 'won' && <Tag variant="success">🏆 당첨</Tag>}
      {effectiveSelected.resultStatus === 'lost' && <Tag variant="outline">미당첨</Tag>}
      <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)' }}>· {effectiveSelected.source}</span>
    </Inline>
  );

  const inLater = effectiveSelected?.status === 'later';
  const inDone  = effectiveSelected?.status === 'done';

  const detail = (
    <DetailPanel topBar={
      <TopBar>
        <Inline>
          <Button variant="primary" onClick={handleApply}>참여하기 ↗</Button>
          <Button kbd="E" disabled={inDone} onClick={() => applyAction(effectiveSelected?.id, 'complete')}>참여완료</Button>
          <Button kbd="L" disabled={inLater} onClick={() => applyAction(effectiveSelected?.id, 'later')}>임시저장</Button>
          <Button variant="ghost" kbd="⌫" onClick={() => applyAction(effectiveSelected?.id, 'skip')}>제외</Button>
        </Inline>
      </TopBar>
    }>
      <Stack size="lg">
        {detailHeader}
        <h1 className="v2-h1">{effectiveSelected.title}</h1>
        <Divider />
        <ResultEntry event={effectiveSelected} onChange={updateEvent} />
        <EventDetailContent event={effectiveSelected} />
      </Stack>
    </DetailPanel>
  );

  const bottomNav = (
    <BottomNav items={BNAV_ITEMS} fab={{ icon: '＋', label: '새 이벤트', onClick: () => {} }}/>
  );

  const sheet = sheetOpen && (
    <>
      <Inline style={{ fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-3)' }}>
        <PlatformChip platform={effectiveSelected.platform} />
        <span className="v2-muted">·</span>
        <span style={{ color: 'var(--c-danger)' }}>{effectiveSelected.deadlineText}</span>
      </Inline>
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
      <ViewSwitcher />
      <AppShell
        nav={nav}
        list={list}
        detail={detail}
        bottomNav={bottomNav}
        sheet={sheet}
        onSheetClose={() => setSheetOpen(false)}
      />
      {toast && <ActionToast toast={toast} onUndo={undoToast} onClose={() => setToast(null)} />}
    </>
  );
}

/* ============================================================
   ActionToast — 액션 후 4초간 표시되는 undo 토스트
   ============================================================ */
function ActionToast({ toast, onUndo, onClose }) {
  return (
    <div className="v2" style={{
      position: 'fixed',
      bottom: 'calc(var(--sp-5) + env(safe-area-inset-bottom, 0px) + 76px)',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 'var(--z-toast)',
      background: 'var(--c-surface-3)',
      border: '1px solid var(--c-line-strong)',
      borderRadius: 'var(--r-lg)',
      padding: 'var(--sp-3) var(--sp-4)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      maxWidth: 'min(440px, calc(100vw - 24px))',
      animation: 'v2-fade var(--dur-base) var(--ease-out)',
    }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text)' }}>
        ✓ {ACTION_LABEL[toast.action]} 처리됨
      </span>
      <button onClick={onUndo} className="v2-btn v2-btn--sm v2-btn--ghost"
        style={{ color: 'var(--c-brand)', minHeight: 28, padding: '0 10px' }}>
        실행 취소 <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.7, marginLeft: 4 }}>U</span>
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

function ViewSwitcher() {
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 100,
      display: 'flex', gap: 4, padding: 4,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)',
    }}>
      <a href="/v2-shell.html" className="v2-pill v2-pill--on" style={{ textDecoration: 'none' }}>App</a>
      <a href="/v2.html" className="v2-pill" style={{ textDecoration: 'none' }}>Tokens</a>
    </div>
  );
}
