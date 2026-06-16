/* ============================================================
   당첨노트 v2 — 앱 셸 + 인증 게이트 + 라우팅
   데이터/인증 레이어는 현재 앱 것을 그대로 재사용한다.
   각 탭 화면은 단계 5·6에서 채운다(현재는 ComingSoon placeholder).
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEvents, useTheme } from '../hooks/useEvents.js';
import { useEventActions } from '../hooks/useEventActions.js';
import {
  getCurrentSession,
  hasAuthConfig,
  loadAuthProfile,
  onAuthRequired,
  onAuthStateChange,
  signInWithGoogle,
  signOut,
} from '../storage/supabaseAuthStorage.js';
import {
  defaultFilterSettings,
  loadFilterSettings,
  normalizeFilterSettings,
  saveFilterSettings,
} from '../storage/filterSettingsStorage.js';
import {
  defaultCommentSettings,
  loadCommentSettings,
  normalizeCommentSettings,
  saveCommentSettings,
} from '../storage/commentSettingsStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseCommentSettings,
  loadSupabaseCrawlerStatus,
  loadSupabaseFilterSettings,
  saveSupabaseCommentSettings,
  saveSupabaseFilterSettings,
  triggerSupabaseCrawler,
} from '../storage/supabaseEventStorage.js';
import {
  buildPlatformOptions,
  isExpiredReadyEvent,
  isInstagramEvent,
  isOldSkippedEvent,
  matchesFilter,
  sortInboxEvents,
} from '../utils/eventModel.js';
import { Icon } from './lib/icons.jsx';
import { Avatar, Badge, Brandmark, Btn, Empty, IconBtn } from './components/primitives.jsx';
import { makeEventActions, toEv } from './lib/adapter.js';
import { AuthGate } from './features/auth/AuthGate.jsx';
import { InboxScreen } from './features/inbox/InboxScreen.jsx';
import { ListScreen, DeadlineScreen, SearchScreen } from './features/events/EventLists.jsx';
import { AdminScreen } from './features/admin/AdminScreen.jsx';
import { FilterPanel } from './features/filter/FilterPanel.jsx';
import { HotdealScreen } from './features/hotdeals/HotdealScreen.jsx';

/* ---------------- responsive helper ---------------- */
function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

/* ---------------- root: auth gate ---------------- */
export default function AppV2() {
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const [authState, setAuthState] = useState({ isLoading: true, session: null, profile: null, error: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadAuth(sessionOverride) {
      try {
        const session = sessionOverride === undefined ? await getCurrentSession() : sessionOverride;
        const profile = session ? await loadAuthProfile(session.access_token) : null;
        if (isMounted) setAuthState({ isLoading: false, session, profile, error: '' });
      } catch (error) {
        if (isMounted) {
          setAuthState({ isLoading: false, session: null, profile: null, error: error.message || '로그인 상태를 확인하지 못했습니다.' });
        }
      }
    }
    loadAuth();
    const unsubscribeAuth = onAuthStateChange((session) => loadAuth(session));
    const unsubscribeRequired = onAuthRequired(() =>
      setAuthState((current) => ({ ...current, session: null, profile: null })),
    );
    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeRequired();
    };
  }, []);

  async function lockApp() {
    await signOut();
    setAuthState({ isLoading: false, session: null, profile: null, error: '' });
  }

  async function handleLogin() {
    setAuthState((c) => ({ ...c, error: '' }));
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthState((c) => ({ ...c, error: error.message || 'Google 로그인을 시작하지 못했습니다.' }));
      setIsSubmitting(false);
    }
  }

  if (authState.isLoading) {
    return <AuthGate stage="loading" theme={theme} onToggleTheme={toggleTheme} />;
  }
  if (!hasAuthConfig || !authState.session) {
    return (
      <AuthGate
        stage="login"
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogin={handleLogin}
        isSubmitting={isSubmitting}
        error={authState.error}
      />
    );
  }
  if (!authState.profile?.approved) {
    return (
      <AuthGate
        stage="pending"
        theme={theme}
        onToggleTheme={toggleTheme}
        account={authState.profile?.email}
        onSwitchAccount={lockApp}
      />
    );
  }

  return <AppV2Main theme={theme} setTheme={setTheme} toggleTheme={toggleTheme} profile={authState.profile} onLock={lockApp} />;
}

/* ---------------- nav config (기프티콘 제외) ---------------- */
const NAV = [
  { id: 'waiting', label: '대기', icon: 'hourglass' },
  { id: 'deadline', label: '마감순', icon: 'clock' },
  { id: 'draft', label: '임시저장', icon: 'bookmark' },
  { id: 'search', label: '검색', icon: 'search' },
  { id: 'inbox', label: '응모함', icon: 'inbox' },
  { id: 'hotdeal', label: '핫딜', icon: 'gift' },
];
const ADMIN_NAV = { id: 'admin', label: '관리자', icon: 'shield' };
const TITLES = {
  waiting: '대기', deadline: '마감 임박', draft: '임시저장',
  search: '검색', inbox: '응모함', hotdeal: '핫딜', admin: '관리자', excluded: '제외된 이벤트',
};

/* ---------------- shell ---------------- */
function AppV2Main({ theme, toggleTheme, profile, onLock }) {
  const { events, setEvents, isLoading } = useEvents();
  const [tab, setTab] = useState('waiting');
  const [syncNotice, setSyncNotice] = useState(null);
  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [commentSettings, setCommentSettings] = useState(loadCommentSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [adminSummary, setAdminSummary] = useState({ pending: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const didLoadFilter = useRef(false);
  const isDesktop = useMedia('(min-width: 901px)');

  const actions = useEventActions({ events, setEvents, setSyncNotice });
  const { actList, actInbox, dispatchUpdate } = useMemo(() => makeEventActions(actions), [actions]);

  const appEvents = useMemo(() => events.filter((e) => !isInstagramEvent(e)), [events]);

  // 설정/크롤러 로딩 (demo·미설정이면 로컬 기본 유지)
  useEffect(() => {
    if (!hasSupabaseConfig) { didLoadFilter.current = true; return; }
    loadSupabaseFilterSettings()
      .then((r) => { if (r) setFilterSettings(normalizeFilterSettings(r)); })
      .catch(() => {})
      .finally(() => { didLoadFilter.current = true; });
  }, []);
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    loadSupabaseCommentSettings().then((r) => { if (r) setCommentSettings(normalizeCommentSettings(r)); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let m = true;
    loadSupabaseCrawlerStatus().then((s) => { if (m) setCrawlerStatus(s); }).catch(() => { if (m) setCrawlerStatus(null); });
    return () => { m = false; };
  }, []);
  useEffect(() => {
    if (!didLoadFilter.current) return;
    if (hasSupabaseConfig) { saveSupabaseFilterSettings(filterSettings).catch(() => {}); return; }
    saveFilterSettings(filterSettings);
  }, [filterSettings]);

  async function handleManualCrawl() {
    if (isCrawling) return;
    setIsCrawling(true);
    setSyncNotice({ type: 'info', message: '크롤링을 시작했습니다. 잠시만 기다려 주세요.' });
    try {
      if (hasSupabaseConfig) {
        const payload = await triggerSupabaseCrawler();
        if (payload?.crawlStatus) setCrawlerStatus(payload.crawlStatus);
        setSyncNotice({ type: 'success', message: '크롤링 작업을 GitHub Actions에 요청했습니다. 완료까지 몇 분 걸릴 수 있습니다.' });
        window.setTimeout(() => setIsCrawling(false), 1200);
        return;
      }
      const response = await fetch('/api/crawl-suto', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '크롤링 실행에 실패했습니다.');
      setSyncNotice({ type: 'success', message: '크롤링이 완료되었습니다. 목록을 다시 불러옵니다.' });
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setSyncNotice({ type: 'warning', message: error.message || '크롤링 실행에 실패했습니다.' });
      setIsCrawling(false);
    }
  }

  async function handleSaveComment() {
    const normalized = normalizeCommentSettings(commentSettings);
    setCommentSettings(normalized);
    try {
      if (hasSupabaseConfig) await saveSupabaseCommentSettings(normalized);
      else saveCommentSettings(normalized);
      setSyncNotice({ type: 'success', message: '댓글 설정을 저장했습니다.' });
    } catch (error) {
      setSyncNotice({ type: 'warning', message: error.message || '댓글 설정 저장에 실패했습니다.' });
    }
  }

  const changeFilter = (patch) => setFilterSettings((cur) => normalizeFilterSettings({ ...cur, ...patch }));
  const changeComment = (patch) => setCommentSettings((cur) => ({ ...cur, ...patch }));
  const resetSettings = () => { setFilterSettings(defaultFilterSettings); setCommentSettings(defaultCommentSettings); };

  const platforms = useMemo(() => buildPlatformOptions(appEvents).map((o) => o.platform), [appEvents]);
  const drawerCounts = useMemo(() => ({
    excluded: appEvents.filter((e) => e.status === 'skipped').length,
    passed: appEvents.filter((e) => isExpiredReadyEvent(e)).length,
    oldExcluded: appEvents.filter((e) => isOldSkippedEvent(e)).length,
  }), [appEvents]);

  const isAdmin = Boolean(profile?.is_admin);
  const navItems = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  const counts = useMemo(() => ({
    waiting: appEvents.filter((e) => matchesFilter(e, 'ready', filterSettings)).length,
    deadline: appEvents.filter((e) => matchesFilter(e, 'todayDeadline', filterSettings)).length,
    draft: appEvents.filter((e) => matchesFilter(e, 'later', filterSettings)).length,
    search: 0,
    inbox: appEvents.filter(
      (e) => e.status === 'done' && (e.resultStatus === 'unknown' || (e.resultStatus === 'won' && e.receiptStatus !== 'received')),
    ).length,
    hotdeal: 0,
    admin: adminSummary.pending,
  }), [appEvents, filterSettings, adminSummary.pending]);

  const inboxEvents = useMemo(
    () => sortInboxEvents(appEvents.filter((e) => e.status === 'done')).map(toEv),
    [appEvents],
  );
  const waitingEvents = useMemo(
    () => appEvents.filter((e) => matchesFilter(e, 'ready', filterSettings)).map(toEv),
    [appEvents, filterSettings],
  );
  const deadlineEvents = useMemo(
    () => appEvents.filter((e) => e.status === 'ready').map(toEv),
    [appEvents],
  );
  const draftEvents = useMemo(
    () => appEvents.filter((e) => matchesFilter(e, 'later', filterSettings)).map(toEv),
    [appEvents, filterSettings],
  );
  const searchEvents = useMemo(
    () => appEvents.filter((e) => e.status !== 'skipped').map(toEv),
    [appEvents],
  );
  const excludedEvents = useMemo(
    () => appEvents.filter((e) => e.status === 'skipped').map(toEv),
    [appEvents],
  );

  function screen() {
    if (isLoading) return <Empty icon="hourglass" title="이벤트를 불러오는 중…" />;
    switch (tab) {
      case 'inbox':
        return <InboxScreen events={inboxEvents} onUpdate={dispatchUpdate} onAction={actInbox} />;
      case 'waiting':
        return <ListScreen events={waitingEvents} onAction={actList} onUpdate={dispatchUpdate} />;
      case 'deadline':
        return <DeadlineScreen events={deadlineEvents} onAction={actList} onUpdate={dispatchUpdate} />;
      case 'draft':
        return <ListScreen events={draftEvents} onAction={actList} onUpdate={dispatchUpdate} emptyTitle="임시저장이 비어 있어요" emptySub="‘나중에 할’ 이벤트를 임시저장해 두세요." />;
      case 'search':
        return <SearchScreen events={searchEvents} onAction={actList} onUpdate={dispatchUpdate} />;
      case 'hotdeal':
        return <HotdealScreen />;
      case 'excluded':
        return <ListScreen events={excludedEvents} onAction={actList} onUpdate={dispatchUpdate} emptyTitle="제외된 이벤트가 없어요" emptySub="제외한 이벤트는 여기서 복구할 수 있어요." />;
      case 'admin':
        return <AdminScreen crawlerStatus={crawlerStatus} isCrawling={isCrawling} onCrawl={handleManualCrawl} onNotice={setSyncNotice} onSummaryChange={setAdminSummary} />;
      default:
        return null;
    }
  }

  const me = {
    name: profile?.display_name || shortenEmail(profile?.email || '') || '내 계정',
    email: profile?.email || '',
    initial: getInitials(profile?.display_name || profile?.email || ''),
    admin: isAdmin,
  };

  const resultCount = {
    waiting: counts.waiting,
    deadline: appEvents.filter((e) => e.status === 'ready').length,
    draft: counts.draft,
    inbox: appEvents.filter((e) => e.status === 'done').length,
    hotdeal: null,
    search: null,
    admin: null,
  }[tab];

  return (
    <div className="app">
      {/* sidebar (desktop) */}
      <aside className="sidebar">
        <div style={{ padding: '18px 16px 14px' }}><Brandmark size={34} /></div>
        <div style={{ margin: '0 12px 8px', padding: 12, borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Avatar initial={me.initial} size={40} admin={me.admin} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name}</span>
              {me.admin && <Badge tone="accent">관리자</Badge>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{me.email}</div>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((it) => <NavItem key={it.id} item={it} active={tab === it.id} count={counts[it.id]} onClick={() => setTab(it.id)} />)}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <IconBtn name={theme === 'dark' ? 'sun' : 'moon'} title="테마 전환" onClick={toggleTheme} style={{ flex: 1 }} />
          <IconBtn name="lock" title="잠금" onClick={onLock} style={{ flex: 1 }} />
        </div>
      </aside>

      {/* main column */}
      <div className="main-col">
        <SyncNotice notice={syncNotice} />
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isDesktop ? '14px 26px' : '12px 15px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flex: 'none' }}>
          {!isDesktop && <Brandmark size={26} />}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, marginLeft: isDesktop ? 0 : 'auto' }}>
            <h1 style={{ margin: 0, fontSize: isDesktop ? 19 : 16, fontWeight: 800, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{TITLES[tab]}</h1>
            {resultCount != null && <span className="tnum topbar-title-sub" style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{resultCount}건</span>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Btn variant="outline" icon="filter" size={isDesktop ? 'md' : 'sm'} title="필터설정" onClick={() => setIsSettingsOpen(true)}>{isDesktop ? '필터설정' : ''}</Btn>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content-inner" key={tab} style={{ animation: 'fadeUp .25s var(--ease-out)' }}>
            {screen()}
          </div>
        </div>
      </div>

      {/* bottom tab bar (mobile) */}
      <nav className="tabbar">
        {navItems.map((it) => <NavItem key={it.id} item={it} active={tab === it.id} count={counts[it.id]} onClick={() => setTab(it.id)} compact />)}
      </nav>

      {isSettingsOpen && (
        <FilterPanel
          filterSettings={filterSettings}
          commentSettings={commentSettings}
          platforms={platforms}
          counts={drawerCounts}
          theme={theme}
          onFilterChange={changeFilter}
          onCommentChange={changeComment}
          onSaveComment={handleSaveComment}
          onToggleTheme={toggleTheme}
          onLock={onLock}
          onReset={resetSettings}
          onGoExcluded={() => { setTab('excluded'); setIsSettingsOpen(false); }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------- sync notice bar ---------------- */
function SyncNotice({ notice }) {
  if (!notice) return null;
  const tones = {
    success: { bg: 'var(--win-weak)', fg: 'var(--win-text)', icon: 'checkCircle' },
    info: { bg: 'var(--info-weak)', fg: 'var(--info)', icon: 'refresh' },
    warning: { bg: 'var(--warn-weak)', fg: 'var(--warn-text)', icon: 'alert' },
  };
  const t = tones[notice.type] || tones.info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: t.bg, color: t.fg, fontSize: 12.5, fontWeight: 600, animation: 'fadeIn .25s', flex: 'none' }}>
      <Icon name={t.icon} size={14} style={notice.type === 'info' ? { animation: 'spin 1.2s linear infinite' } : undefined} />
      {notice.message}
    </div>
  );
}

/* ---------------- nav item ---------------- */
const badgeDot = { position: 'absolute', top: -5, right: -9, fontSize: 9.5, fontWeight: 700, background: 'var(--urgent)', color: 'var(--on-color)', borderRadius: 99, padding: '0 4px', minWidth: 15, height: 15, lineHeight: '15px', textAlign: 'center', border: '2px solid var(--surface)' };

function NavItem({ item, active, count, onClick, compact }) {
  if (compact) {
    return (
      <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px', background: 'none', border: 'none', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'relative', color: active ? 'var(--accent)' : 'var(--text-3)' }}>
          <Icon name={item.icon} size={22} stroke={active ? 2.2 : 1.8} />
          {count > 0 && <span className="tnum" style={badgeDot}>{count > 99 ? '99+' : count}</span>}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 550, color: active ? 'var(--accent)' : 'var(--text-3)' }}>{item.label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className="btn-hover" style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
      border: 'none', background: active ? 'var(--accent-weak)' : 'transparent',
      color: active ? 'var(--accent-text)' : 'var(--text-2)', fontWeight: active ? 700 : 550, fontSize: 13.5, textAlign: 'left', cursor: 'pointer',
    }}>
      <Icon name={item.icon} size={18} stroke={active ? 2.1 : 1.8} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {count > 0 && <span className="tnum" style={{ fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: active ? 'var(--accent)' : 'var(--surface-3)', color: active ? 'var(--on-color)' : 'var(--text-3)', minWidth: 20, textAlign: 'center' }}>{count}</span>}
    </button>
  );
}

/* ---------------- helpers ---------------- */
function getInitials(name) {
  if (!name) return '?';
  const clean = name.split('@')[0];
  const words = clean.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function shortenEmail(email) {
  return email.includes('@') ? email.split('@')[0] : email;
}
