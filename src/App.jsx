import { useEffect, useMemo, useState } from 'react';
import {
  manageFilters,
  primaryFilters,
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
  const { events, setEvents, isLoading } = useEvents();
  const [filter, setFilter] = useState('now');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [syncError, setSyncError] = useState('');
  const [theme, setTheme] = useTheme();

  const { updateStatus, updateResult, updateAnnouncement, updateWinningMeta } =
    useEventActions({ events, setEvents, setSyncError });

  function updateDeadlineStatus(eventId, status) {
    updateStatus(eventId, status);
    if (status === 'done') {
      setFilter('inbox');
    }
  }

  useEffect(() => {
    setPlatformFilter('all');
  }, [filter]);

  const counts = useMemo(() => buildCounts(events), [events]);

  const filteredByTabEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
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
            <span className="list-count">{visibleEvents.length}개</span>
          </div>

          {syncError ? <p className="sync-error">{syncError}</p> : null}

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

function getEmptyMessage(filter) {
  if (filter === 'now') return '지금 바로 처리할 이벤트가 없습니다.';
  if (filter === 'home') return '집에서 처리할 이벤트가 없습니다.';
  if (filter === 'skipped') return '제외한 이벤트가 없습니다.';
  return '표시할 이벤트가 없습니다.';
}

function buildCounts(events) {
  return events.reduce(
    (acc, event) => {
      if (event.status === 'ready') acc.allReady += 1;
      if (event.status === 'ready' && event.actionType === 'now') acc.now += 1;
      if (
        event.status === 'later' ||
        (event.status === 'ready' && event.actionType === 'home')
      ) {
        acc.home += 1;
      }
      if (event.status === 'done') acc.done += 1;
      if (event.status === 'done') acc.inbox += 1;
      if (event.status === 'done' && event.resultStatus === 'unknown') {
        acc.resultUnknown += 1;
      }
      if (matchesFilter(event, 'todayDeadline')) acc.todayDeadline += 1;
      if (matchesFilter(event, 'search')) acc.searchable += 1;
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
