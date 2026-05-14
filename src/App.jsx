import { useEffect, useMemo, useRef, useState } from 'react';
import {
  manageFilters,
  primaryFilters,
  getFilterTitle,
} from './constants.js';
import {
  buildPlatformOptions,
  isInstagramEvent,
  matchesFilter,
  matchesTodayAnnouncement,
  sortInboxEvents,
  sortTodayAnnouncements,
} from './utils/eventModel.js';
import { sortTodayDeadlineEvents } from './utils/deadlineModel.js';
import { parsePrizeAmount } from './utils/format.js';
import {
  defaultFilterSettings,
  loadFilterSettings,
  normalizeFilterSettings,
  parseKeywordInput,
  saveFilterSettings,
} from './storage/filterSettingsStorage.js';
import {
  defaultCommentSettings,
  loadCommentSettings,
  normalizeCommentSettings,
  saveCommentSettings,
} from './storage/commentSettingsStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseCrawlerStatus,
  loadSupabaseCommentSettings,
  loadSupabaseFilterSettings,
  saveSupabaseCommentSettings,
  saveSupabaseFilterSettings,
  triggerSupabaseCrawler,
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
import {
  BottomNav,
  DesktopNav,
} from './components/Navigation.jsx';
import { EventCard } from './components/EventCards.jsx';
import { EventInbox, TodayDeadlineList } from './components/EventInbox.jsx';
import { EventSearch } from './components/EventSearch.jsx';

function App() {
  const [theme, setTheme] = useTheme();
  const [authState, setAuthState] = useState({
    isLoading: true,
    session: null,
    profile: null,
    error: '',
  });

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
            error: error.message || '\uB85C\uADF8\uC778 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
          });
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

  if (authState.isLoading) {
    return (
      <AuthStatusGate
        theme={theme}
        setTheme={setTheme}
        title={'\uB85C\uADF8\uC778 \uD655\uC778 \uC911'}
        message={'\uC7A0\uC2DC\uB9CC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.'}
      />
    );
  }

  if (!hasAuthConfig || !authState.session) {
    return (
      <GoogleLoginGate
        theme={theme}
        setTheme={setTheme}
        error={authState.error}
      />
    );
  }

  if (!authState.profile?.approved) {
    return (
      <PendingApprovalGate
        theme={theme}
        setTheme={setTheme}
        profile={authState.profile}
        onSignOut={lockApp}
      />
    );
  }

  return <EventBotApp theme={theme} setTheme={setTheme} onLock={lockApp} />;
}

function EventBotApp({ theme, setTheme, onLock }) {
  const { events, setEvents, isLoading } = useEvents();
  const [filter, setFilter] = useState('ready');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortMode, setSortMode] = useState('default');
  const [syncNotice, setSyncNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [commentSettings, setCommentSettings] = useState(loadCommentSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const didLoadFilterSettings = useRef(false);
  const didLoadCommentSettings = useRef(false);
  const {
    updateStatus,
    updateResult,
    updateAnnouncement,
    updateWinningMeta,
    deleteInboxEvent,
  } =
    useEventActions({ events, setEvents, setSyncNotice });

  function updateDeadlineStatus(eventId, status) {
    updateStatus(eventId, status);
  }

  useEffect(() => {
    setPlatformFilter('all');
  }, [filter]);

  useEffect(() => {
    if (!isSortableFilter(filter)) {
      setSortMode('default');
    }
  }, [filter]);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      didLoadFilterSettings.current = true;
      return;
    }

    loadSupabaseFilterSettings()
      .then((remoteSettings) => {
        if (remoteSettings) {
          setFilterSettings(normalizeFilterSettings(remoteSettings));
        }
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
    if (!hasSupabaseConfig) {
      didLoadCommentSettings.current = true;
      return;
    }

    loadSupabaseCommentSettings()
      .then((remoteSettings) => {
        if (remoteSettings) {
          setCommentSettings(normalizeCommentSettings(remoteSettings));
        }
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
    if (!hasSupabaseConfig) return;

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
    if (!didLoadFilterSettings.current) return;

    if (hasSupabaseConfig) {
      saveSupabaseFilterSettings(filterSettings).catch((error) => {
        setSyncNotice({
          type: 'warning',
          message: `필터 설정 DB 저장 실패. (${error.message})`,
        });
      });
      return;
    }

    saveFilterSettings(filterSettings);
  }, [filterSettings]);

  async function handleManualCrawl() {
    if (isCrawling) return;
    setIsCrawling(true);
    setSyncNotice({ type: 'info', message: '크롤링을 시작했습니다. 잠시만 기다려 주세요.' });

    try {
      if (hasSupabaseConfig) {
        const payload = await triggerSupabaseCrawler();
        if (payload?.crawlStatus) {
          setCrawlerStatus(payload.crawlStatus);
        }
        setSyncNotice({
          type: 'success',
          message:
            '크롤링 작업을 GitHub Actions에 요청했습니다. 완료까지 몇 분 걸릴 수 있습니다.',
        });
        window.setTimeout(() => setIsCrawling(false), 1200);
        return;
      }

      const response = await fetch('/api/crawl-suto', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '크롤링 실행에 실패했습니다.');
      setSyncNotice({ type: 'success', message: '크롤링이 완료되었습니다. 목록을 다시 불러옵니다.' });
      window.setTimeout(() => window.location.reload(), 900);
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

    try {
      if (hasSupabaseConfig) {
        await saveSupabaseCommentSettings(normalized);
      } else {
        saveCommentSettings(normalized);
      }
      setSyncNotice({ type: 'success', message: '댓글 설정을 저장했습니다.' });
    } catch (error) {
      setSyncNotice({
        type: 'warning',
        message: error.message || '댓글 설정 저장에 실패했습니다.',
      });
    }
  }

  const appEvents = useMemo(() => events.filter((event) => !isInstagramEvent(event)), [events]);

  const counts = useMemo(() => buildCounts(appEvents, filterSettings), [appEvents, filterSettings]);

  const filteredByTabEvents = useMemo(
    () => appEvents.filter((event) => matchesFilter(event, filter, filterSettings)),
    [appEvents, filter, filterSettings],
  );

  const platformOptions = useMemo(
    () => buildPlatformOptions(filteredByTabEvents),
    [filteredByTabEvents],
  );

  const visibleEvents = useMemo(() => {
    const platformEvents =
      platformFilter === 'all'
        ? filteredByTabEvents
        : filteredByTabEvents.filter((event) => event.platform === platformFilter);
    if (isSortableFilter(filter)) return sortEventsByMode(platformEvents, sortMode, filter);
    if (filter === 'inbox') return sortInboxEvents(platformEvents);
    return filter === 'todayAnnouncement'
      ? sortTodayAnnouncements(platformEvents)
      : platformEvents;
  }, [filter, filteredByTabEvents, platformFilter, sortMode]);

  const winningTotal = useMemo(
    () =>
      appEvents
        .filter((event) => event.resultStatus === 'won')
        .reduce((total, event) => total + parsePrizeAmount(event.prizeAmount), 0),
    [appEvents],
  );

  const isManageMode = manageFilters.has(filter);

  return (
    <>
      <main className={`app-shell ${isManageMode ? 'manage-mode' : 'click-mode'}`}>
        <section className="app-hero" aria-label="주요 메뉴">
          <DesktopNav
            counts={counts}
            filters={primaryFilters}
            selectedFilter={filter}
            onSelect={setFilter}
          />
        </section>

        <section className="work-panel" aria-label="이벤트 관리">
          <div className="toolbar">
            <div>
              <p className="section-label">현재 보기</p>
              <h2>{getFilterTitle(filter)}</h2>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => setIsSettingsOpen((current) => !current)}
              >
                필터설정
              </button>
              <span className="list-count">{visibleEvents.length}개</span>
            </div>
          </div>

          {syncNotice ? (
            <p className={`sync-notice sync-${syncNotice.type}`}>{syncNotice.message}</p>
          ) : null}

          {isSettingsOpen ? (
            <FilterSettingsPanel
              events={appEvents}
              settings={filterSettings}
              commentSettings={commentSettings}
              counts={counts}
              selectedFilter={filter}
              theme={theme}
              onChange={setFilterSettings}
              onCommentSettingsChange={setCommentSettings}
              onSaveCommentSettings={handleSaveCommentSettings}
              onThemeChange={setTheme}
              onSelectFilter={setFilter}
              onLock={onLock}
              onCrawl={handleManualCrawl}
              isCrawling={isCrawling}
              crawlerStatus={crawlerStatus}
              onReset={() => setFilterSettings(defaultFilterSettings)}
            />
          ) : null}

          {filter === 'ready' && platformOptions.length > 1 ? (
            <div className="filter-chips" aria-label="이벤트 종류별 보기">
              <button
                type="button"
                className={platformFilter === 'all' ? 'is-active' : ''}
                onClick={() => setPlatformFilter('all')}
              >
                전체 <strong>{filteredByTabEvents.length}</strong>
              </button>
              {platformOptions.map((option) => (
                <button
                  key={option.platform}
                  type="button"
                  className={platformFilter === option.platform ? 'is-active' : ''}
                  onClick={() => setPlatformFilter(option.platform)}
                >
                  {option.platform} <strong>{option.count}</strong>
                </button>
              ))}
            </div>
          ) : null}

          {isSortableFilter(filter) ? (
            <SortChips selectedSort={sortMode} onSelectSort={setSortMode} />
          ) : null}

          {filter === 'todayDeadline' ? (
            <TodayDeadlineList
              events={visibleEvents}
              isLoading={isLoading}
              onStatusChange={updateDeadlineStatus}
            />
          ) : filter === 'search' ? (
            <EventSearch
              events={visibleEvents}
              isLoading={isLoading}
              onStatusChange={updateStatus}
            />
          ) : filter === 'inbox' ? (
            <EventInbox
              events={visibleEvents}
              isLoading={isLoading}
              totalAmount={winningTotal}
              onAnnouncementChange={updateAnnouncement}
              onResultChange={updateResult}
              onMetaChange={updateWinningMeta}
              onDelete={deleteInboxEvent}
            />
          ) : (
            <div className="event-list">
              {visibleEvents.length > 0 ? (
                visibleEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    filter={filter}
                    onResultChange={updateResult}
                    onAnnouncementChange={updateAnnouncement}
                    onStatusChange={updateStatus}
                  />
                ))
              ) : (
                <p className="empty-message">
                  {isLoading ? '이벤트를 불러오는 중입니다.' : getEmptyMessage(filter)}
                </p>
              )}
            </div>
          )}

          {crawlerStatus ? <CrawlerStatusPanel status={crawlerStatus} /> : null}
        </section>
      </main>

      <BottomNav
        counts={counts}
        filters={primaryFilters}
        selectedFilter={filter}
        onSelect={setFilter}
      />
    </>
  );
}

const sortOptions = [
  { value: 'default', label: '기본순' },
  { value: 'popular', label: '인기순' },
  { value: 'winners', label: '당첨자수 많은순' },
  { value: 'deadline', label: '마감임박순' },
  { value: 'newest', label: '최신수집순' },
];

function SortChips({ selectedSort, onSelectSort }) {
  return (
    <div className="sort-options" aria-label="이벤트 정렬">
      {sortOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={selectedSort === option.value ? 'is-active' : ''}
          onClick={() => onSelectSort(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function isSortableFilter(filter) {
  return filter === 'ready' || filter === 'todayDeadline';
}

function sortEventsByMode(events, sortMode, filter) {
  if (sortMode === 'popular') {
    return [...events].sort(
      (first, second) =>
        getNumber(second.bookmarkCount) - getNumber(first.bookmarkCount) ||
        getNumber(first.rank) - getNumber(second.rank),
    );
  }

  if (sortMode === 'winners') {
    return [...events].sort(
      (first, second) =>
        getTotalWinnerCount(second) - getTotalWinnerCount(first) ||
        getNumber(second.bookmarkCount) - getNumber(first.bookmarkCount) ||
        getNumber(first.rank) - getNumber(second.rank),
    );
  }

  if (sortMode === 'deadline') {
    return sortTodayDeadlineEvents(events);
  }

  if (sortMode === 'newest') {
    return [...events].sort(
      (first, second) =>
        getEventTime(second) - getEventTime(first) ||
        getNumber(first.rank) - getNumber(second.rank),
    );
  }

  return filter === 'todayDeadline' ? sortTodayDeadlineEvents(events) : [...events];
}

function getNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function getTotalWinnerCount(event) {
  const raw = event.raw ?? {};
  const direct = parseCount(event.totalWinnerCount ?? raw.totalWinnerCount);
  if (Number.isFinite(direct)) return direct;

  const text = [
    ...(Array.isArray(event.detailMetaLines) ? event.detailMetaLines : []),
    ...(Array.isArray(raw.detailMetaLines) ? raw.detailMetaLines : []),
    event.originalText,
    raw.originalText,
  ].filter(Boolean).join('\n');

  const match = text.match(/(?:총\s*)?당첨자\s*수|당첨\s*인원/i);
  if (!match) return 0;
  const afterLabel = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
  return parseCount(afterLabel) || 0;
}

function parseCount(value) {
  const match = String(value ?? '').match(/\d[\d,]*/);
  if (!match) return NaN;
  const count = Number.parseInt(match[0].replace(/,/g, ''), 10);
  return Number.isFinite(count) ? count : NaN;
}

function getEventTime(event) {
  const value = event.lastSeenAt ?? event.createdAt ?? event.crawledAt ?? '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function GoogleLoginGate({ theme, setTheme, error: initialError }) {
  const [error, setError] = useState(initialError || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    setError('');
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Google \uB85C\uADF8\uC778\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-head">
          <div>
            <p className="app-kicker">EVENT CLICK</p>
            <h1 id="auth-title">Google {'\uB85C\uADF8\uC778'}</h1>
          </div>
          <button
            type="button"
            className="theme-switch"
            aria-label={'\uD14C\uB9C8 \uBCC0\uACBD'}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <div className="auth-form">
          <p className="auth-help">
            {'\uC2B9\uC778\uB41C Google \uACC4\uC815\uC73C\uB85C\uB9CC \uC774\uBCA4\uD2B8\uBD07\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
          </p>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="button" onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? '\uB85C\uADF8\uC778 \uC911' : 'Google\uB85C \uB85C\uADF8\uC778'}
          </button>
        </div>
      </section>
    </main>
  );
}

function PendingApprovalGate({ theme, setTheme, profile, onSignOut }) {
  return (
    <AuthStatusGate
      theme={theme}
      setTheme={setTheme}
      title={'\uC2B9\uC778 \uB300\uAE30 \uC911'}
      message={
        (profile?.email ?? '\uD604\uC7AC \uACC4\uC815') +
        '\uC740 \uC544\uC9C1 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB2E4\uC2DC \uC811\uC18D\uD574 \uC8FC\uC138\uC694.'
      }
      actionLabel={'\uB2E4\uB978 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778'}
      onAction={onSignOut}
    />
  );
}

function AuthStatusGate({ theme, setTheme, title, message, actionLabel, onAction }) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-head">
          <div>
            <p className="app-kicker">EVENT CLICK</p>
            <h1 id="auth-title">{title}</h1>
          </div>
          <button
            type="button"
            className="theme-switch"
            aria-label={'\uD14C\uB9C8 \uBCC0\uACBD'}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <div className="auth-form">
          <p className="auth-help">{message}</p>
          {actionLabel ? (
            <button type="button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
function CrawlerStatusPanel({ status }) {
  const statusInfo = getCrawlerStatusInfo(status?.status);
  const checkedAt = formatDateTime(status.checkedAt ?? status.updatedAt);
  const lastSuccessAt = formatDateTime(status.lastSuccessAt ?? status.checkedAt ?? status.updatedAt);
  const latestSeenAt = formatDateTime(status.latestSeenAt);
  const total = Number.isFinite(status.totalEvents) ? status.totalEvents : '-';
  const recentSeen = Number.isFinite(status.recentSeen24h)
    ? status.recentSeen24h
    : Array.isArray(status.recentEvents)
      ? status.recentEvents.length
      : '-';

  return (
    <section
      className={`crawler-status-panel crawler-status-${statusInfo.kind}`}
      aria-label="크롤링 상태"
    >
      <div>
        <strong>{statusInfo.label}</strong>
        <span>마지막 성공 {lastSuccessAt}</span>
      </div>
      <div>
        <span>DB {total}개</span>
        <span>최근 24시간 {recentSeen}개</span>
        <span>최신 수집 {latestSeenAt}</span>
      </div>
      <p>
        {statusInfo.kind === 'failure'
          ? status.failureMessage || '최근 크롤링이 실패했습니다. 설정의 크롤링하기로 다시 요청해보세요.'
          : `상태 확인 ${checkedAt}`}
      </p>
    </section>
  );
}

function getCrawlerStatusInfo(status) {
  if (status === 'failure') return { kind: 'failure', label: '크롤링 실패' };
  if (status === 'requested') return { kind: 'requested', label: '크롤링 요청됨' };
  return { kind: 'success', label: '크롤링 정상' };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getEmptyMessage(filter) {
  if (filter === 'ready') return '응모 대기 이벤트가 없습니다.';
  if (filter === 'later') return '임시저장한 이벤트가 없습니다.';
  if (filter === 'skipped') return '제외한 이벤트가 없습니다.';
  return '표시할 이벤트가 없습니다.';
}

function FilterSettingsPanel({
  events,
  settings,
  commentSettings,
  counts,
  selectedFilter,
  theme,
  onChange,
  onCommentSettingsChange,
  onSaveCommentSettings,
  onThemeChange,
  onSelectFilter,
  onLock,
  onCrawl,
  isCrawling,
  crawlerStatus,
  onReset,
}) {
  const platforms = useMemo(
    () =>
      [...new Set(events.map((event) => event.platform).filter(Boolean))].sort((first, second) =>
        first.localeCompare(second, 'ko-KR'),
      ),
    [events],
  );
  const keywordText = settings.excludedKeywords.join('\n');
  const lastCrawledAt = formatDateTime(
    crawlerStatus?.lastSuccessAt ?? crawlerStatus?.checkedAt ?? crawlerStatus?.updatedAt,
  );

  function updateSettings(patch) {
    onChange((current) => normalizeFilterSettings({ ...current, ...patch }));
  }

  function togglePlatform(platform) {
    const hiddenPlatforms = new Set(settings.hiddenPlatforms);
    if (hiddenPlatforms.has(platform)) {
      hiddenPlatforms.delete(platform);
    } else {
      hiddenPlatforms.add(platform);
    }
    updateSettings({ hiddenPlatforms: [...hiddenPlatforms] });
  }

  const [keywordDraft, setKeywordDraft] = useState(keywordText);
  const isComposingKeyword = useRef(false);

  useEffect(() => {
    if (!isComposingKeyword.current && keywordDraft !== keywordText) {
      setKeywordDraft(keywordText);
    }
  }, [keywordDraft, keywordText]);

  function saveKeywordDraft(value) {
    updateSettings({ excludedKeywords: parseKeywordInput(value) });
  }

  return (
    <section className="settings-panel" aria-label="필터 설정">
      <div className="settings-actions">
        <button
          type="button"
          className="settings-action-button"
          onClick={() =>
            onThemeChange((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
          }
        >
          {theme === 'dark' ? '라이트 모드' : '다크 모드'}
        </button>
        <button type="button" className="settings-action-button" onClick={onLock}>
          잠금
        </button>
        <div className="settings-crawl-action">
          <button
            type="button"
            className="settings-action-button"
            onClick={onCrawl}
            disabled={isCrawling}
          >
            {isCrawling ? '\uD06C\uB864\uB9C1 \uC911' : '\uD06C\uB864\uB9C1\uD558\uAE30'}
          </button>
          <span>{`\uB9C8\uC9C0\uB9C9 \uC131\uACF5 ${lastCrawledAt}`}</span>
        </div>
        <button
          type="button"
          className={`settings-action-button settings-excluded-button${
            selectedFilter === 'skipped' ? ' is-active' : ''
          }`}
          onClick={() => onSelectFilter('skipped')}
        >
          제외 {counts.skipped}
        </button>
      </div>

      <label className="keyword-field">
        <span>제외 키워드</span>
        <textarea
          rows="3"
          value={keywordDraft}
          placeholder={'\uC608: \uCCB4\uD5D8\uB2E8\n\uB9AC\uADF8\uB7A8'}
          onChange={(event) => {
            setKeywordDraft(event.target.value);
            if (!event.nativeEvent.isComposing && !isComposingKeyword.current) {
              saveKeywordDraft(event.target.value);
            }
          }}
          onCompositionStart={() => {
            isComposingKeyword.current = true;
          }}
          onCompositionEnd={(event) => {
            isComposingKeyword.current = false;
            setKeywordDraft(event.currentTarget.value);
            saveKeywordDraft(event.currentTarget.value);
          }}
          onBlur={(event) => saveKeywordDraft(event.currentTarget.value)}
        />
      </label>

      <section className="comment-settings" aria-label="댓글 생성 설정">
        <div>
          <strong>댓글 생성 설정</strong>
          <span>비워두면 기본 마스터 프롬프트와 서버 Gemini 키를 사용합니다.</span>
        </div>
        <label>
          <span>내 Gemini API 키</span>
          <input
            type="password"
            value={commentSettings.geminiApiKey}
            placeholder="AIza... 개인 키를 쓰고 싶을 때만 입력"
            autoComplete="off"
            onChange={(event) =>
              onCommentSettingsChange((current) =>
                ({ ...current, geminiApiKey: event.target.value }),
              )
            }
          />
        </label>
        <label>
          <span>댓글 작성 프롬프트</span>
          <textarea
            rows="5"
            value={commentSettings.commentPrompt}
            onChange={(event) =>
              onCommentSettingsChange((current) =>
                ({ ...current, commentPrompt: event.target.value }),
              )
            }
          />
        </label>
        <div className="comment-settings-actions">
          <button type="button" className="settings-action-button" onClick={onSaveCommentSettings}>
            댓글 설정 저장
          </button>
          <button
            type="button"
            className="settings-reset"
            onClick={() => onCommentSettingsChange(defaultCommentSettings)}
          >
            기본값
          </button>
        </div>
      </section>

      {platforms.length > 0 ? (
        <div className="platform-settings">
          <span>숨길 플랫폼</span>
          <div>
            {platforms.map((platform) => (
              <button
                key={platform}
                type="button"
                className={settings.hiddenPlatforms.includes(platform) ? 'is-active' : ''}
                onClick={() => togglePlatform(platform)}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="settings-reset" onClick={onReset}>
        기본값
      </button>
    </section>
  );
}

function buildCounts(events, filterSettings) {
  return events.reduce(
    (acc, event) => {
      if (event.status === 'ready') acc.allReady += 1;
      if (matchesFilter(event, 'ready', filterSettings)) acc.ready += 1;
      if (event.status === 'done') acc.done += 1;
      if (event.status === 'done') acc.inbox += 1;
      if (matchesFilter(event, 'later', filterSettings)) acc.later += 1;
      if (event.status === 'done' && event.resultStatus === 'unknown') {
        acc.resultUnknown += 1;
      }
      if (matchesFilter(event, 'todayDeadline', filterSettings)) acc.todayDeadline += 1;
      if (matchesFilter(event, 'search', filterSettings)) acc.searchable += 1;
      if (matchesTodayAnnouncement(event)) acc.todayAnnouncement += 1;
      if (event.resultStatus === 'won') acc.won += 1;
      if (event.resultStatus === 'lost') acc.lost += 1;
      if (event.status === 'skipped') acc.skipped += 1;
      return acc;
    },
    {
      allReady: 0,
      ready: 0,
      done: 0,
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

export default App;
