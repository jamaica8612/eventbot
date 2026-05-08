import { useEffect, useMemo, useRef, useState } from 'react';
import {
  manageFilters,
  primaryFilters,
  utilityFilters,
  getFilterTitle,
} from './constants.js';
import {
  buildPlatformOptions,
  matchesFilter,
  matchesTodayAnnouncement,
  sortInboxEvents,
  sortTodayDeadlineEvents,
  sortTodayAnnouncements,
} from './utils/eventModel.js';
import { parsePrizeAmount } from './utils/format.js';
import {
  defaultFilterSettings,
  loadFilterSettings,
  normalizeFilterSettings,
  parseKeywordInput,
  saveFilterSettings,
} from './storage/filterSettingsStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseCrawlerStatus,
  loadSupabaseFilterSettings,
  saveSupabaseFilterSettings,
} from './storage/supabaseEventStorage.js';
import {
  clearSavedAuth,
  hasSavedAuth,
  verifyPasscode,
} from './storage/passcodeAuthStorage.js';
import { useEventActions } from './hooks/useEventActions.js';
import { useEvents, useTheme } from './hooks/useEvents.js';
import {
  BottomNav,
  DesktopNav,
  SummaryItem,
} from './components/Navigation.jsx';
import { EventCard } from './components/EventCards.jsx';
import { EventInbox, TodayDeadlineList } from './components/EventInbox.jsx';
import { EventSearch } from './components/EventSearch.jsx';

function App() {
  const [theme, setTheme] = useTheme();
  const [isUnlocked, setIsUnlocked] = useState(hasSavedAuth);

  function lockApp() {
    clearSavedAuth();
    setIsUnlocked(false);
  }

  if (!isUnlocked) {
    return (
      <PasscodeGate
        theme={theme}
        setTheme={setTheme}
        onUnlock={() => setIsUnlocked(true)}
      />
    );
  }

  return <EventBotApp theme={theme} setTheme={setTheme} onLock={lockApp} />;
}

function EventBotApp({ theme, setTheme, onLock }) {
  const { events, setEvents, isLoading } = useEvents();
  const [filter, setFilter] = useState('now');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [syncNotice, setSyncNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const didLoadFilterSettings = useRef(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [notificationState, setNotificationState] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
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
    if (status === 'done') {
      setFilter('inbox');
    }
  }

  useEffect(() => {
    setPlatformFilter('all');
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

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  async function requestNotifications() {
    if (typeof Notification === 'undefined') {
      setNotificationState('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
  }

  const counts = useMemo(() => buildCounts(events, filterSettings), [events, filterSettings]);

  const filteredByTabEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter, filterSettings)),
    [events, filter, filterSettings],
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
    if (filter === 'todayDeadline') return sortTodayDeadlineEvents(platformEvents);
    if (filter === 'inbox') return sortInboxEvents(platformEvents);
    return filter === 'todayAnnouncement'
      ? sortTodayAnnouncements(platformEvents)
      : platformEvents;
  }, [filter, filteredByTabEvents, platformFilter]);

  const winningTotal = useMemo(
    () =>
      events
        .filter((event) => event.resultStatus === 'won')
        .reduce((total, event) => total + parsePrizeAmount(event.prizeAmount), 0),
    [events],
  );

  const isManageMode = manageFilters.has(filter);

  return (
    <>
      <main className={`app-shell ${isManageMode ? 'manage-mode' : 'click-mode'}`}>
        <section className="app-hero" aria-labelledby="page-title">
          <div className="hero-top">
            <div className="hero-copy">
              <p className="app-kicker">EVENT CLICK</p>
              <h1 id="page-title">이벤트 딸깍</h1>
              <p className="overview-copy">마감 전에는 빠르게 응모하고, 참여 후에는 응모함에서 정리합니다.</p>
            </div>
            <div className="hero-actions">
              <button
                type="button"
                className="theme-switch"
                aria-label="테마 변경"
                onClick={() =>
                  setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
                }
              >
                {theme === 'dark' ? '다크' : '라이트'}
              </button>
              <button
                type="button"
                className="theme-switch"
                onClick={onLock}
              >
                잠금
              </button>
            </div>
          </div>

          <div className="summary-grid" aria-label="핵심 현황">
            <SummaryItem
              active={filter === 'now'}
              label="지금"
              value={counts.now}
              onClick={() => setFilter('now')}
            />
            <SummaryItem
              active={filter === 'home'}
              label="집에서"
              value={counts.home}
              onClick={() => setFilter('home')}
            />
            <SummaryItem
              active={filter === 'todayDeadline'}
              label="오늘마감"
              value={counts.todayDeadline}
              onClick={() => setFilter('todayDeadline')}
            />
            <SummaryItem
              active={filter === 'inbox'}
              label="응모함"
              value={counts.inbox}
              onClick={() => setFilter('inbox')}
            />
          </div>

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

          {crawlerStatus ? <CrawlerStatusPanel status={crawlerStatus} /> : null}

          {(installPrompt || notificationState !== 'granted') ? (
            <PwaPanel
              canInstall={Boolean(installPrompt)}
              notificationState={notificationState}
              onInstall={installApp}
              onRequestNotifications={requestNotifications}
            />
          ) : null}

          {isSettingsOpen ? (
            <FilterSettingsPanel
              events={events}
              settings={filterSettings}
              onChange={setFilterSettings}
              onReset={() => setFilterSettings(defaultFilterSettings)}
            />
          ) : null}

          <div className="filter-chips utility-filter-chips" aria-label="보조 보기">
            {utilityFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? 'is-active' : ''}
                onClick={() => setFilter(item.value)}
              >
                {item.label} <strong>{counts[item.countKey]}</strong>
              </button>
            ))}
          </div>

          {['now', 'home'].includes(filter) && platformOptions.length > 1 ? (
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

function PasscodeGate({ theme, setTheme, onUnlock }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verifyPasscode(passcode.trim());
      onUnlock();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '비밀번호를 확인해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-head">
          <div>
            <p className="app-kicker">EVENT CLICK</p>
            <h1 id="auth-title">잠금 해제</h1>
          </div>
          <button
            type="button"
            className="theme-switch"
            aria-label="테마 변경"
            onClick={() =>
              setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
            }
          >
            {theme === 'dark' ? '다크' : '라이트'}
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>비밀번호</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoFocus
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" disabled={isSubmitting || !passcode.trim()}>
            {isSubmitting ? '확인 중' : '열기'}
          </button>
        </form>
      </section>
    </main>
  );
}

function PwaPanel({ canInstall, notificationState, onInstall, onRequestNotifications }) {
  return (
    <section className="pwa-panel" aria-label="앱 설치와 알림">
      <div>
        <strong>설치와 알림</strong>
        <span>
          {notificationState === 'granted'
            ? '알림 허용됨'
            : notificationState === 'denied'
              ? '브라우저에서 알림이 차단됨'
              : '발표일과 미수령 알림 준비'}
        </span>
      </div>
      <div>
        {canInstall ? (
          <button type="button" onClick={onInstall}>
            설치
          </button>
        ) : null}
        {notificationState === 'default' ? (
          <button type="button" onClick={onRequestNotifications}>
            알림허용
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CrawlerStatusPanel({ status }) {
  const checkedAt = formatDateTime(status.checkedAt ?? status.updatedAt);
  const latestSeenAt = formatDateTime(status.latestSeenAt);
  const total = Number.isFinite(status.totalEvents) ? status.totalEvents : '-';

  return (
    <section className="crawler-status-panel" aria-label="크롤링 상태">
      <div>
        <strong>크롤링 정상</strong>
        <span>마지막 확인 {checkedAt}</span>
      </div>
      <div>
        <span>DB {total}개</span>
        <span>최신 수집 {latestSeenAt}</span>
      </div>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getEmptyMessage(filter) {
  if (filter === 'now') return '지금 바로 처리할 이벤트가 없습니다.';
  if (filter === 'home') return '집에서 처리할 이벤트가 없습니다.';
  if (filter === 'skipped') return '제외한 이벤트가 없습니다.';
  return '표시할 이벤트가 없습니다.';
}

function FilterSettingsPanel({ events, settings, onChange, onReset }) {
  const platforms = useMemo(
    () =>
      [...new Set(events.map((event) => event.platform).filter(Boolean))].sort((first, second) =>
        first.localeCompare(second, 'ko-KR'),
      ),
    [events],
  );
  const keywordText = settings.excludedKeywords.join('\n');

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

  return (
    <section className="settings-panel" aria-label="필터 설정">
      <div className="settings-grid">
        <label>
          <span>지금 기준</span>
          <input
            type="number"
            min="0"
            max="100"
            value={settings.nowScore}
            onChange={(event) => updateSettings({ nowScore: event.target.value })}
          />
        </label>
        <label>
          <span>집에서 기준</span>
          <input
            type="number"
            min="0"
            max={settings.nowScore}
            value={settings.homeScore}
            onChange={(event) => updateSettings({ homeScore: event.target.value })}
          />
        </label>
      </div>

      <label className="keyword-field">
        <span>제외 키워드</span>
        <textarea
          rows="3"
          value={keywordText}
          placeholder={'예: 출석\n리그램'}
          onChange={(event) =>
            updateSettings({ excludedKeywords: parseKeywordInput(event.target.value) })
          }
        />
      </label>

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
      if (matchesFilter(event, 'now', filterSettings)) acc.now += 1;
      if (
        event.status === 'later' ||
        matchesFilter(event, 'home', filterSettings)
      ) {
        acc.home += 1;
      }
      if (event.status === 'done') acc.done += 1;
      if (event.status === 'done') acc.inbox += 1;
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
      now: 0,
      home: 0,
      done: 0,
      inbox: 0,
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
