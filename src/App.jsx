import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFilterTitle,
  primaryFilters,
} from './constants.js';
import {
  buildPlatformOptions,
  isExpiredReadyEvent,
  isInstagramEvent,
  isOldSkippedEvent,
  matchesFilter,
  matchesSearchQuery,
  matchesTodayAnnouncement,
  sortInboxEvents,
  sortSearchEvents,
  sortTodayAnnouncements,
} from './utils/eventModel.js';
import { getTodayDeadlineMatch, sortTodayDeadlineEvents } from './utils/deadlineModel.js';
import { parsePrizeAmount } from './utils/format.js';
import {
  defaultFilterSettings,
  loadFilterSettings,
  normalizeFilterSettings,
} from './storage/filterSettingsStorage.js';
import {
  defaultCommentSettings,
  loadCommentSettings,
  normalizeCommentSettings,
} from './storage/commentSettingsStorage.js';
import {
  loadViewState,
  saveViewState,
} from './storage/viewStateStorage.js';
import {
  loadSupabaseAdminUsers,
  loadSupabaseCommentSettings,
  loadSupabaseCrawlerStatus,
  loadSupabaseFilterSettings,
  saveSupabaseCommentSettings,
  saveSupabaseFilterSettings,
  triggerSupabaseCrawler,
  updateSupabaseProfileAccess,
} from './storage/supabaseEventStorage.js';
import {
  getCurrentSession,
  hasAuthConfig,
  loadAuthProfile,
  onAuthRequired,
  onAuthStateChange,
  signInWithGoogle,
  signOut,
} from './storage/supabaseAuthStorage.js';
import { useEventActions } from './hooks/useEventActions.js';
import { useEvents, useTheme } from './hooks/useEvents.js';
import { AuthGate } from './features/auth/AuthGate.jsx';
import { AdminScreen } from './features/admin/AdminScreen.jsx';
import { DeadlineScreen, EventsList } from './features/events/EventsList.jsx';
import { FilterPanel } from './features/filter/FilterPanel.jsx';
import { InboxScreen } from './features/inbox/InboxScreen.jsx';
import { Avatar } from './components/Avatar.jsx';
import { Badge } from './components/Badge.jsx';
import { Button, IconBtn } from './components/Button.jsx';
import { Chip } from './components/Chip.jsx';
import { Empty } from './components/Empty.jsx';
import { Icon } from './components/Icon.jsx';
import { PlatformBadge } from './components/PlatformBadge.jsx';

const ADMIN_FILTER = { value: 'admin', label: '관리자', countKey: 'admin', icon: 'shield' };
const FILTER_ICONS = {
  ready: 'hourglass',
  todayDeadline: 'clock',
  later: 'bookmark',
  search: 'search',
  inbox: 'inbox',
  skipped: 'x',
  admin: 'shield',
};
const shouldBypassAuth = import.meta.env.DEV && import.meta.env.VITE_EVENTBOT_BYPASS_AUTH === 'true';
const bypassProfile = {
  user_id: 'local-preview',
  email: 'preview@eventbot.local',
  display_name: 'Preview Admin',
  approved: true,
  is_admin: true,
};
const previewNow = new Date();
const previewIso = (offset, hour = 18) => {
  const date = new Date(previewNow);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};
const previewEvents = [
  {
    id: 'preview-ready-today',
    platform: '유튜브 이벤트',
    status: 'ready',
    title: '신제품 런칭 기념 구독 댓글 이벤트',
    deadlineDate: previewIso(0, 23),
    deadlineText: '오늘 마감',
    prizeTitle: '올리브영 모바일 상품권 3만원',
    description: '구독과 좋아요를 누르고 기대평을 댓글로 남기면 추첨을 통해 모바일 상품권을 드립니다.',
    url: 'https://youtube.com/watch?v=preview',
    bookmarkCount: 482,
    totalWinnerCount: 30,
    lastSeenAt: previewIso(-1, 9),
  },
  {
    id: 'preview-ready-week',
    platform: '네이버 이벤트',
    status: 'ready',
    title: '여름맞이 체험단 모집',
    deadlineDate: previewIso(2, 18),
    deadlineText: '2일 후 마감',
    prizeTitle: '스타벅스 5만원권',
    description: '블로그에 체험 후기를 남겨 주세요. 선정자에게 기프티콘을 지급합니다.',
    url: 'https://blog.naver.com/preview',
    bookmarkCount: 211,
    totalWinnerCount: 50,
    lastSeenAt: previewIso(-1, 11),
  },
  {
    id: 'preview-later',
    platform: '홈페이지 이벤트',
    status: 'later',
    title: '조건 확인이 필요한 카드 발급 이벤트',
    deadlineDate: previewIso(7, 18),
    deadlineText: '다음 주 마감',
    prizeTitle: '캐시백 최대 15만원',
    description: '조건이 복잡해 임시저장한 이벤트입니다.',
    url: 'https://example.com/event',
    bookmarkCount: 17,
    totalWinnerCount: 999,
    lastSeenAt: previewIso(-2, 12),
  },
  {
    id: 'preview-inbox-overdue',
    platform: '네이버 이벤트',
    status: 'done',
    title: '신용카드 리뷰 작성 이벤트',
    resultStatus: 'unknown',
    receiptStatus: 'unclaimed',
    resultAnnouncementDate: previewIso(-2, 18),
    resultAnnouncementText: '발표일 지남',
    participatedAt: previewIso(-12, 12),
    prizeTitle: '네이버페이 5천원',
    description: '응모 완료 후 결과 확인이 필요한 이벤트입니다.',
    url: 'https://blog.naver.com/result-preview',
    bookmarkCount: 88,
    totalWinnerCount: 200,
    lastSeenAt: previewIso(-13, 9),
  },
  {
    id: 'preview-inbox-today',
    platform: '홈페이지 이벤트',
    status: 'done',
    title: '호텔 숙박권 사전예약 응모',
    resultStatus: 'unknown',
    receiptStatus: 'unclaimed',
    resultAnnouncementDate: previewIso(0, 18),
    resultAnnouncementText: '오늘 발표',
    participatedAt: previewIso(-8, 19),
    prizeTitle: '호텔 숙박권',
    description: '오늘 발표 예정인 응모 건입니다.',
    url: 'https://example.com/result',
    bookmarkCount: 540,
    totalWinnerCount: 10,
    lastSeenAt: previewIso(-9, 9),
  },
  {
    id: 'preview-inbox-won',
    platform: '유튜브 이벤트',
    status: 'done',
    title: '편의점 인기템 기프티콘 이벤트',
    resultStatus: 'won',
    receiptStatus: 'unclaimed',
    resultAnnouncementDate: previewIso(-5, 18),
    participatedAt: previewIso(-15, 20),
    prizeTitle: 'GS25 모바일 상품권',
    prizeAmount: '10000',
    description: '당첨되었지만 아직 수령 전인 이벤트입니다.',
    url: 'https://youtube.com/watch?v=won-preview',
    bookmarkCount: 305,
    totalWinnerCount: 100,
    lastSeenAt: previewIso(-16, 9),
  },
  {
    id: 'preview-skipped',
    platform: '홈페이지 이벤트',
    status: 'skipped',
    title: '관심 없는 상담 신청 이벤트',
    deadlineDate: previewIso(-5, 18),
    deadlineText: '마감 지남',
    prizeTitle: '커피 쿠폰',
    description: '제외 목록 확인용 이벤트입니다.',
    url: 'https://example.com/skipped',
    bookmarkCount: 3,
    totalWinnerCount: 20,
    lastSeenAt: previewIso(-20, 9),
  },
];
const previewAdminUsers = [
  {
    id: 'local-preview',
    user_id: 'local-preview',
    email: 'preview@eventbot.local',
    display_name: 'Preview Admin',
    approved: true,
    is_admin: true,
    stats: { done: 8, won: 2, lost: 1, unreceived: 1, prize: 160000 },
  },
  {
    id: 'pending-preview',
    user_id: 'pending-preview',
    email: 'pending@eventbot.local',
    display_name: 'Pending User',
    approved: false,
    is_admin: false,
    stats: { done: 1, won: 0, lost: 0, unreceived: 0, prize: 0 },
  },
];

function App() {
  const [theme, setTheme] = useTheme();
  const [authState, setAuthState] = useState({
    isLoading: true,
    session: null,
    profile: null,
    error: '',
  });
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAuth(sessionOverride) {
      try {
        const session =
          sessionOverride === undefined ? await getCurrentSession() : sessionOverride;
        const profile = session ? await loadAuthProfile(session.access_token) : null;
        if (isMounted) setAuthState({ isLoading: false, session, profile, error: '' });
      } catch (error) {
        if (isMounted) {
          setAuthState({
            isLoading: false,
            session: null,
            profile: null,
            error: error.message || '로그인 상태를 확인하지 못했습니다.',
          });
        }
      } finally {
        if (isMounted) setIsSubmittingLogin(false);
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

  async function handleLogin() {
    setIsSubmittingLogin(true);
    setAuthState((current) => ({ ...current, error: '' }));
    try {
      await signInWithGoogle();
    } catch (error) {
      setIsSubmittingLogin(false);
      setAuthState((current) => ({
        ...current,
        error: error.message || 'Google 로그인을 시작하지 못했습니다.',
      }));
    }
  }

  async function lockApp() {
    await signOut();
    setAuthState({ isLoading: false, session: null, profile: null, error: '' });
  }

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  if (shouldBypassAuth) {
    return (
      <EventBotApp
        theme={theme}
        setTheme={setTheme}
        profile={bypassProfile}
        onLock={() => {}}
      />
    );
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
        error={authState.error}
        isSubmitting={isSubmittingLogin}
      />
    );
  }

  if (!authState.profile?.approved) {
    return (
      <AuthGate
        stage="pending"
        theme={theme}
        onToggleTheme={toggleTheme}
        account={authState.profile?.email || authState.session?.user?.email || '현재 계정'}
        onSwitchAccount={lockApp}
      />
    );
  }

  return (
    <EventBotApp
      theme={theme}
      setTheme={setTheme}
      profile={authState.profile}
      onLock={lockApp}
    />
  );
}

function EventBotApp({ theme, setTheme, profile, onLock }) {
  const { events, setEvents, isLoading, loadError } = useEvents();
  const [viewState, setViewState] = useState(loadViewState);
  const [filter, setFilterState] = useState(viewState.filter);
  const [platformFilter, setPlatformFilterState] = useState(viewState.platformFilter);
  const [deadlineFilter, setDeadlineFilterState] = useState(viewState.deadlineFilter);
  const [inboxFilter, setInboxFilterState] = useState(viewState.inboxFilter);
  const [searchQuery, setSearchQueryState] = useState(viewState.searchQuery);
  const [searchScope, setSearchScopeState] = useState(viewState.searchScope);
  const [syncNotice, setSyncNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [commentSettings, setCommentSettings] = useState(loadCommentSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [updatingAdminUserId, setUpdatingAdminUserId] = useState('');
  const didLoadFilterSettings = useRef(false);
  const didLoadCommentSettings = useRef(false);

  const {
    updateStatus,
    updateResult,
    updateAnnouncement,
    updateDeadline,
    updateWinningMeta,
    deleteInboxEvent,
  } = useEventActions({ events, setEvents, setSyncNotice });

  function updateViewState(patch) {
    setViewState((current) => {
      const next = { ...current, ...patch };
      saveViewState(next);
      return next;
    });
  }

  function setFilter(value) {
    setFilterState(value);
    setIsSettingsOpen(false);
    updateViewState({ filter: value });
  }

  function setPlatformFilter(value) {
    setPlatformFilterState(value);
    updateViewState({ platformFilter: value });
  }

  function setDeadlineFilter(value) {
    setDeadlineFilterState(value);
    updateViewState({ deadlineFilter: value });
  }

  function setInboxFilter(value) {
    setInboxFilterState(value);
    updateViewState({ inboxFilter: value });
  }

  function setSearchQuery(value) {
    setSearchQueryState(value);
    updateViewState({ searchQuery: value });
  }

  function setSearchScope(value) {
    setSearchScopeState(value);
    updateViewState({ searchScope: value });
  }

  useEffect(() => {
    if (shouldBypassAuth) return;
    if (loadError) setSyncNotice({ type: 'warning', message: loadError });
  }, [loadError]);

  useEffect(() => {
    if (!shouldBypassAuth) return;
    if (events.length > 0) return;
    setEvents(previewEvents);
    setAdminUsers(previewAdminUsers);
    setCrawlerStatus({
      status: 'ok',
      totalEvents: previewEvents.length,
      recentSeen24h: 3,
      lastCrawledAt: previewIso(0, 9),
      lastSuccessAt: previewIso(0, 9),
    });
  }, [events.length, setEvents]);

  useEffect(() => {
    if (!profile?.is_admin && filter === 'admin') setFilter('ready');
  }, [filter, profile?.is_admin]);

  useEffect(() => {
    if (shouldBypassAuth) {
      didLoadFilterSettings.current = true;
      return;
    }
    loadSupabaseFilterSettings()
      .then((remoteSettings) => {
        if (remoteSettings) setFilterSettings(normalizeFilterSettings(remoteSettings));
      })
      .catch((error) => {
        setSyncNotice({
          type: 'warning',
          message: `필터 설정을 DB에서 불러오지 못했습니다. (${error.message})`,
        });
      })
      .finally(() => {
        didLoadFilterSettings.current = true;
      });
  }, []);

  useEffect(() => {
    if (shouldBypassAuth) {
      didLoadCommentSettings.current = true;
      return;
    }
    loadSupabaseCommentSettings()
      .then((remoteSettings) => {
        if (remoteSettings) setCommentSettings(normalizeCommentSettings(remoteSettings));
      })
      .catch((error) => {
        setSyncNotice({
          type: 'warning',
          message: `댓글 설정을 DB에서 불러오지 못했습니다. (${error.message})`,
        });
      })
      .finally(() => {
        didLoadCommentSettings.current = true;
      });
  }, []);

  useEffect(() => {
    if (shouldBypassAuth) return;
    let isMounted = true;
    loadSupabaseCrawlerStatus()
      .then((status) => {
        if (isMounted) setCrawlerStatus(status);
      })
      .catch(() => {
        if (isMounted) setCrawlerStatus(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile?.is_admin || shouldBypassAuth) return;
    let isMounted = true;
    loadSupabaseAdminUsers()
      .then((users) => {
        if (isMounted) setAdminUsers(users.map(normalizeAdminUser));
      })
      .catch((error) => {
        if (isMounted) {
          setSyncNotice({
            type: 'warning',
            message: error.message || '관리자 사용자 정보를 불러오지 못했습니다.',
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [profile?.is_admin]);

  useEffect(() => {
    if (!didLoadFilterSettings.current) return;
    if (shouldBypassAuth) return;
    saveSupabaseFilterSettings(filterSettings).catch((error) => {
      setSyncNotice({
        type: 'warning',
        message: `필터 설정 DB 저장 실패. (${error.message})`,
      });
    });
  }, [filterSettings]);

  async function handleManualCrawl() {
    if (isCrawling) return;
    if (shouldBypassAuth) {
      setSyncNotice({ type: 'info', message: '로컬 미리보기에서는 크롤링 요청을 보내지 않습니다.' });
      return;
    }
    setIsCrawling(true);
    setSyncNotice({ type: 'info', message: '크롤링을 요청했습니다.' });

    try {
      const payload = await triggerSupabaseCrawler();
      if (payload?.crawlStatus) setCrawlerStatus(payload.crawlStatus);
      setSyncNotice({
        type: 'success',
        message: '크롤링 작업을 GitHub Actions에 요청했습니다.',
      });
      window.setTimeout(() => setIsCrawling(false), 1200);
    } catch (error) {
      setSyncNotice({
        type: 'warning',
        message: error.message || '크롤링 실행에 실패했습니다.',
      });
      setIsCrawling(false);
    }
  }

  async function handleSaveCommentSettings() {
    const normalized = normalizeCommentSettings(commentSettings);
    setCommentSettings(normalized);
    didLoadCommentSettings.current = true;

    try {
      if (shouldBypassAuth) {
        setSyncNotice({ type: 'success', message: '댓글 설정을 저장했습니다. (로컬 미리보기)' });
        return;
      }
      await saveSupabaseCommentSettings(normalized);
      setSyncNotice({ type: 'success', message: '댓글 설정을 저장했습니다.' });
    } catch (error) {
      setSyncNotice({
        type: 'warning',
        message: error.message || '댓글 설정 저장에 실패했습니다.',
      });
    }
  }

  async function handleAdminUserChange(user, patch) {
    const userId = user.user_id || user.id;
    setUpdatingAdminUserId(userId);
    try {
      if (shouldBypassAuth) {
        setAdminUsers((current) =>
          current.map((item) =>
            item.id === userId || item.user_id === userId
              ? {
                  ...item,
                  ...(typeof patch.approved === 'boolean' ? { approved: patch.approved } : {}),
                  ...(typeof patch.is_admin === 'boolean' ? { is_admin: patch.is_admin } : {}),
                }
              : item,
          ),
        );
        setSyncNotice({ type: 'success', message: '사용자 권한을 저장했습니다. (로컬 미리보기)' });
        return;
      }
      await updateSupabaseProfileAccess(userId, {
        ...(typeof patch.approved === 'boolean' ? { approved: patch.approved } : {}),
        ...(typeof patch.is_admin === 'boolean' ? { isAdmin: patch.is_admin } : {}),
      });
      setAdminUsers((current) =>
        current.map((item) =>
          item.id === userId || item.user_id === userId
            ? {
                ...item,
                ...(typeof patch.approved === 'boolean' ? { approved: patch.approved } : {}),
                ...(typeof patch.is_admin === 'boolean' ? { is_admin: patch.is_admin } : {}),
              }
            : item,
        ),
      );
      setSyncNotice({ type: 'success', message: '사용자 권한을 저장했습니다.' });
    } catch (error) {
      setSyncNotice({
        type: 'warning',
        message: error.message || '사용자 권한 저장에 실패했습니다.',
      });
    } finally {
      setUpdatingAdminUserId('');
    }
  }

  const appEvents = useMemo(() => events.filter((event) => !isInstagramEvent(event)), [events]);
  const isAdmin = Boolean(profile?.is_admin);
  const navFilters = useMemo(
    () => (isAdmin ? [...primaryFilters, ADMIN_FILTER] : primaryFilters),
    [isAdmin],
  );

  const counts = useMemo(
    () => ({
      ...buildCounts(appEvents, filterSettings),
      admin: adminUsers.filter((user) => !user.approved).length,
    }),
    [adminUsers, appEvents, filterSettings],
  );

  const filteredByTabEvents = useMemo(
    () => appEvents.filter((event) => matchesFilter(event, filter, filterSettings)),
    [appEvents, filter, filterSettings],
  );

  const platformOptions = useMemo(
    () => buildPlatformOptions(filteredByTabEvents),
    [filteredByTabEvents],
  );

  useEffect(() => {
    if (
      platformFilter !== 'all' &&
      !platformOptions.some((option) => option.platform === platformFilter)
    ) {
      setPlatformFilter('all');
    }
  }, [platformFilter, platformOptions]);

  const visibleEvents = useMemo(() => {
    const platformEvents =
      platformFilter === 'all'
        ? filteredByTabEvents
        : filteredByTabEvents.filter((event) => event.platform === platformFilter);

    if (filter === 'search') {
      return sortSearchEvents(
        platformEvents.filter((event) => {
          if (searchScope === 'ready' && event.status !== 'ready') return false;
          if (searchScope === 'done' && event.status !== 'done') return false;
          return matchesSearchQuery(event, searchQuery);
        }),
      );
    }
    if (filter === 'todayDeadline') return sortTodayDeadlineEvents(platformEvents);
    if (filter === 'inbox') return sortInboxEvents(platformEvents);
    if (filter === 'todayAnnouncement') return sortTodayAnnouncements(platformEvents);
    return platformEvents;
  }, [filter, filteredByTabEvents, platformFilter, searchQuery, searchScope]);

  const winningTotal = useMemo(
    () =>
      appEvents
        .filter((event) => event.resultStatus === 'won')
        .reduce((total, event) => total + parsePrizeAmount(event.prizeAmount), 0),
    [appEvents],
  );

  const resultCount = filter === 'admin' ? adminUsers.length : visibleEvents.length;
  const title = getFilterTitle(filter) || '이벤트';

  return (
    <div className="dn-app">
      <aside className="dn-sidebar" aria-label="주요 메뉴">
        <div className="dn-brand">
          <Brandmark />
        </div>
        <ProfileCard
          profile={profile}
          crawlerStatus={crawlerStatus}
        />
        <nav className="dn-nav">
          {navFilters.map((item) => (
            <NavItem
              key={item.value}
              item={item}
              active={filter === item.value}
              count={counts[item.countKey]}
              onClick={() => setFilter(item.value)}
            />
          ))}
        </nav>
        <div className="dn-sidebar-actions">
          <IconBtn
            name={theme === 'dark' ? 'sun' : 'moon'}
            title="테마 전환"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
          <IconBtn name="lock" title="잠금" onClick={onLock} />
        </div>
      </aside>

      <div className="dn-main-col">
        <SyncNotice notice={syncNotice} />
        <header className="dn-topbar">
          <div className="dn-mobile-brand">
            <Brandmark compact />
          </div>
          <div className="dn-topbar-title">
            <h1>{title}</h1>
            <span className="tnum">{resultCount}건</span>
          </div>
          <div className="dn-topbar-actions">
            <Button
              variant="outline"
              icon="filter"
              className="dn-filter-button"
              onClick={() => setIsSettingsOpen(true)}
            >
              필터설정
            </Button>
          </div>
        </header>

        <main className="dn-content-scroll">
          <div className="dn-content-inner" key={filter}>
            {filter === 'ready' && platformOptions.length > 1 ? (
              <PlatformChips
                options={platformOptions}
                selected={platformFilter}
                total={filteredByTabEvents.length}
                onSelect={setPlatformFilter}
              />
            ) : null}

            {filter === 'search' ? (
              <SearchControls
                query={searchQuery}
                scope={searchScope}
                onQueryChange={setSearchQuery}
                onScopeChange={setSearchScope}
              />
            ) : null}

            {renderScreen({
              filter,
              events: visibleEvents,
              isLoading,
              deadlineFilter,
              setDeadlineFilter,
              inboxFilter,
              setInboxFilter,
              winningTotal,
              updateStatus,
              updateDeadline,
              updateResult,
              updateAnnouncement,
              updateWinningMeta,
              deleteInboxEvent,
              searchQuery,
              adminUsers,
              updatingAdminUserId,
              handleAdminUserChange,
              crawlerStatus,
              isCrawling,
              handleManualCrawl,
              setSyncNotice,
            })}
          </div>
        </main>
      </div>

      <nav className="dn-tabbar" aria-label="하단 메뉴">
        {navFilters.map((item) => (
          <NavItem
            key={item.value}
            item={item}
            active={filter === item.value}
            count={counts[item.countKey]}
            onClick={() => setFilter(item.value)}
            compact
          />
        ))}
      </nav>

      {isSettingsOpen ? (
        <FilterPanel
          settings={filterSettings}
          commentSettings={commentSettings}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onLock={onLock}
          counts={{
            skipped: counts.skipped,
            passed: appEvents.filter(isExpiredReadyEvent).length,
            oldExcluded: appEvents.filter(isOldSkippedEvent).length,
          }}
          onGoExcluded={() => {
            setFilter('skipped');
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
          onFilterChange={(patch) =>
            setFilterSettings((current) => normalizeFilterSettings({ ...current, ...patch }))
          }
          onCommentSettingsChange={setCommentSettings}
          onSaveCommentSettings={handleSaveCommentSettings}
          onReset={() => setFilterSettings(defaultFilterSettings)}
        />
      ) : null}
    </div>
  );
}

function renderScreen({
  filter,
  events,
  isLoading,
  deadlineFilter,
  setDeadlineFilter,
  inboxFilter,
  setInboxFilter,
  winningTotal,
  updateStatus,
  updateDeadline,
  updateResult,
  updateAnnouncement,
  updateWinningMeta,
  deleteInboxEvent,
  searchQuery,
  adminUsers,
  updatingAdminUserId,
  handleAdminUserChange,
  crawlerStatus,
  isCrawling,
  handleManualCrawl,
  setSyncNotice,
}) {
  if (filter === 'admin') {
    return (
      <AdminScreen
        users={adminUsers}
        crawlerStatus={crawlerStatus}
        isCrawling={isCrawling}
        onCrawl={handleManualCrawl}
        onNotice={setSyncNotice}
        onUserChange={handleAdminUserChange}
        updatingUserId={updatingAdminUserId}
      />
    );
  }

  if (filter === 'todayDeadline') {
    return (
      <DeadlineScreen
        events={events}
        isLoading={isLoading}
        selectedFilter={deadlineFilter}
        onSelectFilter={setDeadlineFilter}
        onDeadlineChange={updateDeadline}
        onStatusChange={updateStatus}
      />
    );
  }

  if (filter === 'inbox') {
    return (
      <InboxScreen
        events={events}
        isLoading={isLoading}
        selectedFilter={inboxFilter}
        onSelectFilter={setInboxFilter}
        totalAmount={winningTotal}
        onAnnouncementChange={updateAnnouncement}
        onResultChange={updateResult}
        onMetaChange={updateWinningMeta}
        onDelete={deleteInboxEvent}
      />
    );
  }

  if (events.length === 0 && !isLoading) {
    return <Empty icon={FILTER_ICONS[filter] || 'inbox'} title={getEmptyMessage(filter)} />;
  }

  return (
    <EventsList
      events={events}
      filter={filter}
      isLoading={isLoading}
      onStatusChange={updateStatus}
      onDeadlineChange={updateDeadline}
      onResultChange={updateResult}
      onAnnouncementChange={updateAnnouncement}
      query={filter === 'search' ? searchQuery : ''}
    />
  );
}

function SyncNotice({ notice }) {
  if (!notice) return null;
  return (
    <div className={`dn-sync dn-sync-${notice.type || 'info'}`} role="status">
      <Icon
        name={notice.type === 'success' ? 'checkCircle' : notice.type === 'warning' ? 'alert' : 'cloud'}
        size={15}
      />
      <span>{notice.message}</span>
    </div>
  );
}

function Brandmark({ compact = false }) {
  return (
    <div className={`dn-brandmark${compact ? ' is-compact' : ''}`}>
      <span className="dn-brandmark-icon">
        <Icon name="trophy" size={compact ? 15 : 18} stroke={2.1} />
      </span>
      {!compact ? <strong>당첨노트</strong> : null}
    </div>
  );
}

function ProfileCard({ profile, crawlerStatus }) {
  const name = profile?.display_name || profile?.email?.split('@')[0] || '사용자';
  const recentSeen = Number.isFinite(crawlerStatus?.recentSeen24h)
    ? crawlerStatus.recentSeen24h
    : Array.isArray(crawlerStatus?.recentEvents)
      ? crawlerStatus.recentEvents.length
      : null;
  const crawlerInfo = getCrawlerStatusInfo(crawlerStatus?.status, recentSeen);

  return (
    <section className="dn-profile">
      <Avatar initial={getInitials(name)} size={40} admin={profile?.is_admin} />
      <div>
        <strong>{name}</strong>
        <span>
          <i className={`dn-status-dot dn-status-${crawlerInfo.kind}`} />
          {crawlerInfo.label}
        </span>
      </div>
      {profile?.is_admin ? <Badge tone="accent">관리자</Badge> : null}
    </section>
  );
}

function NavItem({ item, active, count, onClick, compact = false }) {
  const icon = item.icon || FILTER_ICONS[item.value] || 'inbox';
  return (
    <button
      type="button"
      className={`dn-nav-item${active ? ' is-active' : ''}${compact ? ' is-compact' : ''}`}
      onClick={onClick}
    >
      <span className="dn-nav-icon">
        <Icon name={icon} size={compact ? 19 : 17} />
        {compact && count > 0 ? <b className="tnum">{count}</b> : null}
      </span>
      <span>{item.label}</span>
      {!compact && count > 0 ? <b className="tnum">{count}</b> : null}
    </button>
  );
}

function PlatformChips({ options, selected, total, onSelect }) {
  return (
    <div className="dn-chip-row">
      <Chip active={selected === 'all'} count={total} onClick={() => onSelect('all')}>
        전체
      </Chip>
      {options.map((option) => (
        <button
          key={option.platform}
          type="button"
          className={`dn-platform-chip${selected === option.platform ? ' is-active' : ''}`}
          onClick={() => onSelect(option.platform)}
        >
          <PlatformBadge platform={option.platform} />
          <span>{option.platform}</span>
          <b className="tnum">{option.count}</b>
        </button>
      ))}
    </div>
  );
}

function SearchControls({ query, scope, onQueryChange, onScopeChange }) {
  return (
    <section className="dn-search-panel">
      <Icon name="search" size={17} />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="제목, 경품, 본문, 발표 문구를 검색"
      />
      <div className="dn-search-scope">
        {[
          { value: 'all', label: '전체' },
          { value: 'ready', label: '대기' },
          { value: 'done', label: '응모' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={scope === item.value ? 'is-active' : ''}
            onClick={() => onScopeChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function normalizeAdminUser(user) {
  const stats = user.stats || {};
  return {
    ...user,
    id: user.user_id || user.id,
    user_id: user.user_id || user.id,
    display_name: user.display_name || user.name || user.email?.split('@')[0],
    is_admin: Boolean(user.is_admin),
    approved: Boolean(user.approved),
    stats: {
      ...stats,
      done: Number(stats.done) || 0,
      won: Number(stats.won) || 0,
      lost: Number(stats.lost) || 0,
      unreceived: Number(stats.unreceived) || 0,
      prize: Number(stats.prize ?? stats.prizeAmount) || 0,
    },
  };
}

function buildCounts(events, filterSettings) {
  return events.reduce(
    (acc, event) => {
      if (matchesFilter(event, 'ready', filterSettings)) acc.ready += 1;
      if (event.status === 'done') acc.inbox += 1;
      if (matchesFilter(event, 'later', filterSettings)) acc.later += 1;
      if (matchesFilter(event, 'todayDeadline', filterSettings) && getTodayDeadlineMatch(event).isMatch) {
        acc.todayDeadline += 1;
      }
      if (matchesFilter(event, 'search', filterSettings)) acc.searchable += 1;
      if (event.resultStatus === 'unknown') acc.resultUnknown += 1;
      if (matchesTodayAnnouncement(event)) acc.todayAnnouncement += 1;
      if (event.resultStatus === 'won') acc.won += 1;
      if (event.resultStatus === 'lost') acc.lost += 1;
      if (event.status === 'skipped') acc.skipped += 1;
      return acc;
    },
    {
      ready: 0,
      inbox: 0,
      later: 0,
      todayDeadline: 0,
      searchable: 0,
      resultUnknown: 0,
      todayAnnouncement: 0,
      won: 0,
      lost: 0,
      skipped: 0,
    },
  );
}

function getCrawlerStatusInfo(status, recentSeen) {
  if (status === 'failure') return { kind: 'failure', label: '크롤러 실패' };
  if (status === 'requested') return { kind: 'requested', label: '크롤러 요청됨' };
  if (recentSeen === 0) return { kind: 'quiet', label: '신규 수집 없음' };
  return { kind: 'success', label: '크롤러 정상' };
}

function getEmptyMessage(filter) {
  if (filter === 'ready') return '응모 대기 이벤트가 없어요';
  if (filter === 'later') return '임시저장한 이벤트가 없어요';
  if (filter === 'skipped') return '제외한 이벤트가 없어요';
  if (filter === 'search') return '검색 결과가 없어요';
  return '표시할 이벤트가 없어요';
}

function getInitials(name) {
  if (!name) return '?';
  const clean = name.split('@')[0];
  const words = clean.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export default App;
