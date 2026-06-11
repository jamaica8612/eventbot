import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isInstagramEvent } from './utils/eventModel.js';
import { deadlineMeta } from './lib/domain.js';
import {
  defaultFilterSettings, loadFilterSettings, normalizeFilterSettings, saveFilterSettings,
} from './storage/filterSettingsStorage.js';
import {
  defaultCommentSettings, loadCommentSettings, normalizeCommentSettings, saveCommentSettings,
} from './storage/commentSettingsStorage.js';
import { loadViewState } from './storage/viewStateStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseCrawlerStatus,
  loadSupabaseCommentSettings,
  loadSupabaseFilterSettings,
  loadSupabaseAdminUsers,
  saveSupabaseCommentSettings,
  saveSupabaseFilterSettings,
  triggerSupabaseCrawler,
  updateSupabaseProfileAccess,
} from './storage/supabaseEventStorage.js';
import {
  getCurrentSession, hasAuthConfig, loadAuthProfile,
  onAuthRequired, onAuthStateChange, signInWithGoogle, signOut,
} from './storage/supabaseAuthStorage.js';
import { useEventActions } from './hooks/useEventActions.js';
import { useEvents, useTheme } from './hooks/useEvents.js';

import { AuthGate } from './features/auth/AuthGate.jsx';
import { EventsList, DeadlineScreen } from './features/events/EventsList.jsx';
import { EventCard } from './features/events/EventCard.jsx';
import { InboxScreen } from './features/inbox/InboxScreen.jsx';
import { AdminScreen } from './features/admin/AdminScreen.jsx';
import { FilterPanel } from './features/filter/FilterPanel.jsx';
import { Icon, Button, IconBtn, Badge, Avatar, Empty, Chip } from './components/index.jsx';

import './styles/app.css';

/* ============================================================
   NAV
   ============================================================ */
const NAV = [
  { id: 'waiting',  label: '대기',     icon: 'hourglass' },
  { id: 'deadline', label: '마감순',   icon: 'clock' },
  { id: 'draft',    label: '임시저장', icon: 'bookmark' },
  { id: 'search',   label: '검색',     icon: 'search' },
  { id: 'inbox',    label: '응모함',   icon: 'inbox' },
];
const ADMIN_NAV = { id: 'admin', label: '관리자', icon: 'shield' };

const TAB_TITLES = {
  waiting:  '대기',
  deadline: '마감 임박',
  draft:    '임시저장',
  search:   '검색',
  inbox:    '응모함',
  admin:    '관리자',
  excluded: '제외된 이벤트',
};

/* ============================================================
   SyncNotice
   ============================================================ */
function SyncNotice({ notice }) {
  if (!notice) return null;
  const cls = { success: 'sync-bar-success', info: 'sync-bar-info', warning: 'sync-bar-warning' }[notice.type] || 'sync-bar-info';
  const iconName = { success: 'checkCircle', info: 'refresh', warning: 'alert' }[notice.type] || 'refresh';
  return (
    <div className={`sync-bar ${cls}`}>
      <Icon name={iconName} size={14} style={notice.type === 'info' ? { animation: 'spin 1.2s linear infinite' } : undefined} />
      {notice.msg || notice.message}
    </div>
  );
}

/* ============================================================
   NavItem
   ============================================================ */
const badgeDotStyle = {
  position: 'absolute', top: -5, right: -9, fontSize: 9.5, fontWeight: 700,
  background: 'var(--urgent)', color: '#fff', borderRadius: 99,
  padding: '0 4px', minWidth: 15, height: 15, lineHeight: '15px',
  textAlign: 'center', border: '2px solid var(--surface)',
};

function NavItem({ item, active, count, onClick, compact }) {
  if (compact) {
    return (
      <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <span style={{ position: 'relative', color: active ? 'var(--accent)' : 'var(--text-3)' }}>
          <Icon name={item.icon} size={22} stroke={active ? 2.2 : 1.8} />
          {count > 0 && <span className="tnum" style={badgeDotStyle}>{count > 99 ? '99+' : count}</span>}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 550, color: active ? 'var(--accent)' : 'var(--text-3)' }}>{item.label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px',
      borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
      background: active ? 'var(--accent-weak)' : 'transparent',
      color: active ? 'var(--accent-text)' : 'var(--text-2)',
      fontWeight: active ? 700 : 550, fontSize: 13.5, textAlign: 'left',
      transition: 'background .12s var(--ease)',
    }}>
      <Icon name={item.icon} size={18} stroke={active ? 2.1 : 1.8} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {count > 0 && (
        <span className="tnum" style={{ fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: active ? 'var(--accent)' : 'var(--surface-3)', color: active ? '#fff' : 'var(--text-3)', minWidth: 20, textAlign: 'center' }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ============================================================
   Brandmark
   ============================================================ */
function Brandmark({ size = 34 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: size, height: size, borderRadius: size * 0.3, background: 'linear-gradient(140deg, var(--accent), var(--home))', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px -4px var(--accent)' }}>
        <Icon name="trophy" size={size * 0.5} stroke={2} style={{ color: '#fff' }} />
      </span>
      <span style={{ fontSize: size * 0.48, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>{'당첨노트'}</span>
    </span>
  );
}

/* ============================================================
   SearchScreen
   ============================================================ */
const SEARCH_SCOPES = [
  { key: 'all',     label: '전체' },
  { key: 'waiting', label: '대기' },
  { key: 'entered', label: '응모함' },
  { key: 'win',     label: '당첨' },
];

function SearchScreen({ allEvents, onAction, onUpdate }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!terms.length) return [];
    return allEvents.filter(ev => {
      if (scope === 'waiting' && !['ready', 'later'].includes(ev.status)) return false;
      if (scope === 'entered' && ev.status !== 'done') return false;
      if (scope === 'win' && ev.resultStatus !== 'won') return false;
      const hay = [ev.title, ev.originalText, ev.prizeText, ev.prizeTitle].filter(Boolean).join(' ').toLowerCase();
      return terms.every(t => hay.includes(t));
    });
  }, [q, scope, allEvents]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-3)' }} />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={'여러 단어로 검색 (AND)…'}
          style={{ width: '100%', padding: '12px 14px 12px 42px', fontSize: 14.5, borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {SEARCH_SCOPES.map(s => <Chip key={s.key} active={scope === s.key} onClick={() => setScope(s.key)}>{s.label}</Chip>)}
      </div>
      {!terms.length
        ? <Empty icon="search" title={'검색어를 입력하세요'} sub={'제목·본문·경품명에서 모든 단어를 포함한 이벤트를 찾아요.'} />
        : results.length === 0
          ? <Empty icon="search" title={'결과가 없어요'} sub={`"${q}"와 일치하는 이벤트가 없습니다.`} />
          : (
            <div style={{ display: 'grid', gap: 12 }}>
              {results.map(ev => (
                <EventCard key={ev.id} event={ev} onAction={onAction} onUpdate={onUpdate} query={q} />
              ))}
            </div>
          )
      }
    </div>
  );
}

/* ============================================================
   App (auth routing)
   ============================================================ */
function App() {
  const [theme, setTheme] = useTheme();
  const [authState, setAuthState] = useState({ isLoading: true, session: null, profile: null, error: '' });

  useEffect(() => {
    let isMounted = true;

    async function loadAuth(sessionOverride) {
      try {
        const session = sessionOverride === undefined ? await getCurrentSession() : sessionOverride;
        const profile = session ? await loadAuthProfile(session.access_token) : null;
        if (isMounted) setAuthState({ isLoading: false, session, profile, error: '' });
      } catch (error) {
        if (isMounted) setAuthState({ isLoading: false, session: null, profile: null, error: error.message || '로그인 상태를 확인하지 못했습니다.' });
      }
    }

    loadAuth();
    const unsubAuth     = onAuthStateChange(session => loadAuth(session));
    const unsubRequired = onAuthRequired(() => setAuthState(c => ({ ...c, session: null, profile: null })));
    return () => { isMounted = false; unsubAuth(); unsubRequired(); };
  }, []);

  async function lockApp() {
    await signOut();
    setAuthState({ isLoading: false, session: null, profile: null, error: '' });
  }

  const stage = authState.isLoading ? 'loading'
    : (!hasAuthConfig || !authState.session) ? 'login'
    : !authState.profile?.approved ? 'pending'
    : 'app';

  if (stage !== 'app') {
    return (
      <AuthGate
        stage={stage}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onLogin={() => signInWithGoogle()}
        onSwitchAccount={lockApp}
        account={authState.profile?.email || ''}
      />
    );
  }

  return (
    <MainApp
      theme={theme}
      setTheme={setTheme}
      profile={authState.profile}
      onLock={lockApp}
    />
  );
}

/* ============================================================
   MainApp
   ============================================================ */
function MainApp({ theme, setTheme, profile, onLock }) {
  const { events, setEvents, isLoading, loadError } = useEvents();
  const [tab, setTab] = useState(() => loadViewState().filter === 'inbox' ? 'inbox' : 'waiting');
  const [filterOpen, setFilterOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [commentSettings, setCommentSettings] = useState(loadCommentSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [isCrawling, setIsCrawling] = useState(false);

  const didLoadFilter  = useRef(false);
  const didLoadComment = useRef(false);

  const {
    updateStatus, updateResult, updateAnnouncement,
    updateDeadline, updateWinningMeta, deleteInboxEvent,
  } = useEventActions({ events, setEvents, setSyncNotice });

  useEffect(() => {
    if (!hasSupabaseConfig) { didLoadFilter.current = true; return; }
    loadSupabaseFilterSettings()
      .then(r => { if (r) setFilterSettings(normalizeFilterSettings(r)); })
      .catch(e => setSyncNotice({ type: 'warning', message: `필터 설정 불러오기 실패. (${e.message})` }))
      .finally(() => { didLoadFilter.current = true; });
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) { didLoadComment.current = true; return; }
    loadSupabaseCommentSettings()
      .then(r => { if (r) setCommentSettings(normalizeCommentSettings(r)); })
      .catch(e => setSyncNotice({ type: 'warning', message: `댓글 설정 불러오기 실패. (${e.message})` }))
      .finally(() => { didLoadComment.current = true; });
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let ok = true;
    loadSupabaseCrawlerStatus().then(s => { if (ok) setCrawlerStatus(s); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const isAdmin = Boolean(profile?.is_admin);
  useEffect(() => {
    if (!isAdmin || !hasSupabaseConfig) return;
    loadSupabaseAdminUsers().then(setAdminUsers).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!didLoadFilter.current) return;
    if (hasSupabaseConfig) {
      saveSupabaseFilterSettings(filterSettings).catch(e => setSyncNotice({ type: 'warning', message: `필터 저장 실패. (${e.message})` }));
    } else {
      saveFilterSettings(filterSettings);
    }
  }, [filterSettings]);

  useEffect(() => {
    if (loadError) setSyncNotice({ type: 'warning', message: loadError });
  }, [loadError]);

  const handleAction = useCallback((eventId, action) => {
    const event = events.find(e => e.id === eventId);
    if (action === 'enter') {
      updateStatus(eventId, 'done');
      setTimeout(() => setTab('inbox'), 250);
    } else if (action === 'draft') {
      updateStatus(eventId, 'later');
    } else if (action === 'toWaiting') {
      if (event?.status === 'done') deleteInboxEvent(eventId);
      else updateStatus(eventId, 'ready');
    } else if (action === 'exclude') {
      updateStatus(eventId, 'skipped');
    }
  }, [events, updateStatus, deleteInboxEvent]);

  const handleUpdate = useCallback((eventId, patch) => {
    if ('deadlineDate' in patch || ('deadlineText' in patch && !('resultStatus' in patch) && !('receiptStatus' in patch) && !('resultAnnouncementDate' in patch))) {
      const ev = events.find(e => e.id === eventId);
      updateDeadline(eventId, {
        deadlineDate: patch.deadlineDate ?? ev?.deadlineDate ?? '',
        deadlineText: patch.deadlineText ?? ev?.deadlineText ?? '',
      });
      return;
    }
    if ('resultStatus' in patch) {
      updateResult(eventId, patch.resultStatus);
      return;
    }
    if ('resultAnnouncementDate' in patch) {
      const ev = events.find(e => e.id === eventId);
      updateAnnouncement(eventId, {
        resultAnnouncementDate: patch.resultAnnouncementDate,
        resultAnnouncementText: patch.resultAnnouncementText ?? ev?.resultAnnouncementText ?? '',
      });
      return;
    }
    if ('receiptStatus' in patch || 'prizeTitle' in patch || 'prizeAmount' in patch || 'winningMemo' in patch) {
      updateWinningMeta(eventId, patch);
      return;
    }
    setEvents(curr => curr.map(e => e.id === eventId ? { ...e, ...patch } : e));
  }, [events, updateDeadline, updateResult, updateAnnouncement, updateWinningMeta, setEvents]);

  function handleFilterChange(patch) {
    if (patch.__reset) {
      setFilterSettings(defaultFilterSettings);
      setCommentSettings(defaultCommentSettings);
      return;
    }
    if ('excludeKeywords' in patch) setFilterSettings(s => ({ ...s, excludedKeywords: patch.excludeKeywords }));
    if ('hidePassed' in patch)      setFilterSettings(s => ({ ...s, hideExpiredReadyEvents: patch.hidePassed }));
    if ('hiddenPlatforms' in patch) setFilterSettings(s => ({ ...s, hiddenPlatforms: patch.hiddenPlatforms }));
    if ('geminiKey' in patch) {
      const next = normalizeCommentSettings({ ...commentSettings, geminiApiKey: patch.geminiKey });
      setCommentSettings(next);
      if (hasSupabaseConfig) saveSupabaseCommentSettings(next).catch(() => {});
      else saveCommentSettings(next);
    }
    if ('commentPrompt' in patch) {
      const next = normalizeCommentSettings({ ...commentSettings, commentPrompt: patch.commentPrompt });
      setCommentSettings(next);
      if (hasSupabaseConfig) saveSupabaseCommentSettings(next).catch(() => {});
      else saveCommentSettings(next);
    }
  }

  async function handleCrawl() {
    if (isCrawling) return;
    setIsCrawling(true);
    setSyncNotice({ type: 'info', message: '크롤링을 요청했습니다 (GitHub Actions)…' });
    try {
      const payload = await triggerSupabaseCrawler();
      if (payload?.crawlStatus) setCrawlerStatus(payload.crawlStatus);
      setSyncNotice({ type: 'success', message: '크롤링을 GitHub Actions에 요청했습니다.' });
    } catch (e) {
      setSyncNotice({ type: 'warning', message: e.message || '크롤링 실행에 실패했습니다.' });
    } finally {
      window.setTimeout(() => setIsCrawling(false), 1200);
    }
  }

  async function handleUserChange(userId, patch) {
    try {
      await updateSupabaseProfileAccess(userId, patch);
      setAdminUsers(us => us.map(u => u.id === userId ? { ...u, ...patch } : u));
      setSyncNotice({ type: 'success', message: '사용자 정보를 변경했어요.' });
    } catch (e) {
      setSyncNotice({ type: 'warning', message: `변경 실패. (${e.message})` });
    }
  }

  const appEvents   = useMemo(() => events.filter(e => !isInstagramEvent(e)), [events]);
  const navItems    = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  const waitingAll   = useMemo(() => appEvents.filter(e => e.status === 'ready'), [appEvents]);
  const waitingShown = useMemo(() => filterSettings.hideExpiredReadyEvents
    ? waitingAll.filter(e => deadlineMeta(e.deadlineDate).key !== 'passed')
    : waitingAll,
    [waitingAll, filterSettings.hideExpiredReadyEvents]);
  const draftList    = useMemo(() => appEvents.filter(e => e.status === 'later'), [appEvents]);
  const inboxList    = useMemo(() => appEvents.filter(e => e.status === 'done'), [appEvents]);
  const excludedList = useMemo(() => appEvents.filter(e => e.status === 'skipped'), [appEvents]);

  const passedCount  = useMemo(() => waitingAll.filter(e => deadlineMeta(e.deadlineDate).key === 'passed').length, [waitingAll]);
  const oldExcluded  = useMemo(() => excludedList.filter(e => deadlineMeta(e.deadlineDate).key === 'passed').length, [excludedList]);

  const inboxAttention = useMemo(() =>
    inboxList.filter(e => e.resultStatus === 'unknown' || (e.resultStatus === 'won' && e.receiptStatus !== 'received')).length,
    [inboxList]);
  const deadlineCount = useMemo(() =>
    waitingAll.filter(e => ['today', 'tomorrow', 'soon'].includes(deadlineMeta(e.deadlineDate).key)).length,
    [waitingAll]);
  const adminPendingCount = adminUsers.filter(u => !u.approved).length;

  const counts = {
    waiting:  waitingShown.length,
    deadline: deadlineCount,
    draft:    draftList.length,
    search:   0,
    inbox:    inboxAttention,
    admin:    adminPendingCount,
  };

  const panelSettings = {
    excludeKeywords: filterSettings.excludedKeywords,
    hidePassed:      filterSettings.hideExpiredReadyEvents,
    hiddenPlatforms: filterSettings.hiddenPlatforms,
    geminiKey:       commentSettings.geminiApiKey || '',
    commentPrompt:   commentSettings.commentPrompt || '',
  };

  const visibleWaiting = useMemo(() =>
    waitingShown.filter(e => !(filterSettings.hiddenPlatforms || []).includes(e.platform)),
    [waitingShown, filterSettings.hiddenPlatforms]);

  const tabCount = {
    waiting:  visibleWaiting.length,
    deadline: waitingAll.filter(e => !(filterSettings.hiddenPlatforms || []).includes(e.platform) && deadlineMeta(e.deadlineDate).key !== 'passed').length,
    draft:    draftList.length,
    inbox:    inboxList.length,
    search:   null,
    admin:    adminUsers.length,
    excluded: excludedList.length,
  }[tab];

  function renderScreen() {
    switch (tab) {
      case 'waiting':
        return <EventsList events={visibleWaiting} onAction={handleAction} onUpdate={handleUpdate} />;
      case 'deadline':
        return <DeadlineScreen
          events={waitingAll.filter(e => !(filterSettings.hiddenPlatforms || []).includes(e.platform))}
          onAction={handleAction} onUpdate={handleUpdate}
        />;
      case 'draft':
        return draftList.length
          ? <EventsList events={draftList} onAction={handleAction} onUpdate={handleUpdate} />
          : <Empty icon="bookmark" title={'임시저장이 비어 있어요'} sub={"'나중에 할' 이벤트를 임시저장해 두세요."} />;
      case 'search':
        return <SearchScreen
          allEvents={appEvents.filter(e => e.status !== 'skipped')}
          onAction={handleAction} onUpdate={handleUpdate}
        />;
      case 'inbox':
        return <InboxScreen events={inboxList} onUpdate={handleUpdate} onAction={handleAction} />;
      case 'admin':
        return <AdminScreen
          users={adminUsers}
          crawler={crawlerStatus || { status: 'empty', total: 0, new24h: 0 }}
          onUserChange={handleUserChange}
          onCrawl={handleCrawl}
        />;
      case 'excluded':
        return excludedList.length
          ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {excludedList.map(ev => <EventCard key={ev.id} event={ev} onAction={handleAction} onUpdate={handleUpdate} />)}
            </div>
          )
          : <Empty icon="x" title={'제외된 이벤트가 없어요'} />;
      default:
        return null;
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div style={{ padding: '18px 16px 14px' }}>
          <Brandmark size={34} />
        </div>

        <div style={{ margin: '0 12px 8px', padding: 12, borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Avatar
            initial={(profile?.display_name || profile?.email || '?').slice(0, 1).toUpperCase()}
            size={40}
            admin={isAdmin}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.display_name || profile?.email || '사용자'}
              </span>
              {isAdmin && <Badge tone="accent">{'관리자'}</Badge>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: crawlerStatus?.status === 'ok' ? 'var(--win)' : 'var(--text-3)' }} />
              {crawlerStatus?.status === 'ok' ? '크롤러 정상' : '크롤러 상태 미확인'}
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(it => (
            <NavItem key={it.id} item={it} active={tab === it.id} count={counts[it.id] || 0} onClick={() => setTab(it.id)} />
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <IconBtn name={theme === 'dark' ? 'sun' : 'moon'} title={'테마 전환'} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ flex: 1 }} />
          <IconBtn name="lock" title={'잌금'} onClick={onLock} style={{ flex: 1 }} />
        </div>
      </aside>

      <div className="main-col">
        <SyncNotice notice={syncNotice} />

        <header className="topbar">
          <Brandmark size={26} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, marginLeft: 'auto' }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>
              {TAB_TITLES[tab]}
            </h1>
            {tabCount != null && (
              <span className="tnum" style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{tabCount}{'건'}</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="outline" icon="filter" size="sm" onClick={() => setFilterOpen(true)}>
              {'필터'}
            </Button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content-inner" key={tab} style={{ animation: 'fadeUp .25s var(--ease-out)' }}>
            {isLoading
              ? <Empty icon="refresh" title={'불러오는 중…'} />
              : renderScreen()
            }
          </div>
        </div>
      </div>

      <nav className="tabbar">
        {navItems.map(it => (
          <NavItem key={it.id} item={it} active={tab === it.id} count={counts[it.id] || 0} onClick={() => setTab(it.id)} compact />
        ))}
      </nav>

      {filterOpen && (
        <FilterPanel
          settings={panelSettings}
          onChange={handleFilterChange}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          onLock={() => { setFilterOpen(false); onLock(); }}
          counts={{ excluded: excludedList.length, passed: passedCount, oldExcluded }}
          onGoExcluded={() => { setTab('excluded'); setFilterOpen(false); }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
