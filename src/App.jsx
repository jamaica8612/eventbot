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
  hasSupabaseConfig,
  loadSupabaseCrawlerStatus,
  loadSupabaseFilterSettings,
  saveSupabaseFilterSettings,
} from './storage/supabaseEventStorage.js';
import {
  clearSavedAuth,
  hasSavedAuth,
  onAuthRequired,
  verifyPasscode,
} from './storage/passcodeAuthStorage.js';
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
  const [isUnlocked, setIsUnlocked] = useState(hasSavedAuth);

  useEffect(() => onAuthRequired(() => setIsUnlocked(false)), []);

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
  const [filter, setFilter] = useState('ready');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [syncNotice, setSyncNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState(loadFilterSettings);
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const didLoadFilterSettings = useRef(false);
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
    if (filter === 'todayDeadline') return sortTodayDeadlineEvents(platformEvents);
    if (filter === 'inbox') return sortInboxEvents(platformEvents);
    return filter === 'todayAnnouncement'
      ? sortTodayAnnouncements(platformEvents)
      : platformEvents;
  }, [filter, filteredByTabEvents, platformFilter]);

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
              counts={counts}
              selectedFilter={filter}
              theme={theme}
              onChange={setFilterSettings}
              onThemeChange={setTheme}
              onSelectFilter={setFilter}
              onLock={onLock}
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
  if (filter === 'ready') return '응모 대기 이벤트가 없습니다.';
  if (filter === 'later') return '임시저장한 이벤트가 없습니다.';
  if (filter === 'skipped') return '제외한 이벤트가 없습니다.';
  return '표시할 이벤트가 없습니다.';
}

function FilterSettingsPanel({
  events,
  settings,
  counts,
  selectedFilter,
  theme,
  onChange,
  onThemeChange,
  onSelectFilter,
  onLock,
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
