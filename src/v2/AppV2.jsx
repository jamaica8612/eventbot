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
import { loadFilterSettings } from '../storage/filterSettingsStorage.js';
import { isInstagramEvent, matchesFilter } from '../utils/eventModel.js';
import { Icon } from './lib/icons.jsx';
import { Avatar, Badge, Brandmark, Btn, Empty, IconBtn } from './components/primitives.jsx';
import { makeEventActions } from './lib/adapter.js';
import { AuthGate } from './features/auth/AuthGate.jsx';

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

// dev 전용: ?v2&demo 로 인증을 건너뛰고 셸/화면을 확인 (실제 전환 시 제거 검토)
const DEMO_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
const DEMO_PROFILE = { approved: true, is_admin: true, email: 'demo@local', display_name: '데모 사용자' };

/* ---------------- root: auth gate ---------------- */
export default function AppV2() {
  const [theme, setTheme] = useTheme();
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const [authState, setAuthState] = useState({ isLoading: true, session: null, profile: null, error: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return undefined;
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

  if (DEMO_MODE) {
    return <AppV2Main theme={theme} setTheme={setTheme} toggleTheme={toggleTheme} profile={DEMO_PROFILE} onLock={() => {}} />;
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
];
const ADMIN_NAV = { id: 'admin', label: '관리자', icon: 'shield' };
const TITLES = {
  waiting: '대기', deadline: '마감 임박', draft: '임시저장',
  search: '검색', inbox: '응모함', admin: '관리자',
};

/* ---------------- shell ---------------- */
function AppV2Main({ theme, toggleTheme, profile, onLock }) {
  const { events, setEvents, isLoading } = useEvents();
  const [tab, setTab] = useState('waiting');
  const [syncNotice, setSyncNotice] = useState(null);
  const [filterSettings] = useState(loadFilterSettings);
  const isDesktop = useMedia('(min-width: 901px)');

  const actions = useEventActions({ events, setEvents, setSyncNotice });
  const { actList, actInbox, dispatchUpdate } = useMemo(() => makeEventActions(actions), [actions]);

  const appEvents = useMemo(() => events.filter((e) => !isInstagramEvent(e)), [events]);

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
    admin: 0,
  }), [appEvents, filterSettings]);

  // 탭 콘텐츠 (단계 5·6에서 실제 화면으로 교체)
  function screen() {
    const tabEventCount = {
      waiting: counts.waiting,
      deadline: appEvents.filter((e) => e.status === 'ready').length,
      draft: counts.draft,
      search: appEvents.filter((e) => e.status !== 'skipped').length,
      inbox: appEvents.filter((e) => e.status === 'done').length,
      admin: 0,
    }[tab];
    if (isLoading) return <Empty icon="hourglass" title="이벤트를 불러오는 중…" />;
    return <Empty icon="sparkles" title={`${TITLES[tab]} · 화면 준비 중`} sub={`다음 단계에서 추가됩니다 (현재 ${tabEventCount ?? 0}건)`} />;
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
            <Btn variant="outline" icon="filter" size={isDesktop ? 'md' : 'sm'} title="필터설정">{isDesktop ? '필터설정' : ''}</Btn>
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
