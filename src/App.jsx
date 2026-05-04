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
  sortTodayAnnouncements,
} from './utils/eventModel.js';
import { formatCompactWon, parsePrizeAmount } from './utils/format.js';
import { useEventActions } from './hooks/useEventActions.js';
import { useEvents, useTheme } from './hooks/useEvents.js';
import {
  BottomNav,
  DesktopNav,
  ManageMetrics,
  SummaryItem,
} from './components/Navigation.jsx';
import { EventCard } from './components/EventCards.jsx';
import { WinningLedger } from './components/WinningLedger.jsx';
import {
  CompletedManagementList,
  ResultManagementList,
} from './components/ManagementLists.jsx';

function App() {
  const { events, setEvents, isLoading } = useEvents();
  const [filter, setFilter] = useState('now');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [syncError, setSyncError] = useState('');
  const [theme, setTheme] = useTheme();

  const { updateStatus, updateResult, updateAnnouncement, updateWinningMeta } =
    useEventActions({ events, setEvents, setSyncError });

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
              <h1 id="page-title">지금 딸깍</h1>
              <p className="overview-copy">한 손으로 보고 바로 누를 것만 남깁니다.</p>
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
              active={filter === 'todayAnnouncement'}
              label="발표예정"
              value={counts.todayAnnouncement}
              onClick={() => setFilter('todayAnnouncement')}
            />
            <SummaryItem
              active={filter === 'won'}
              label="당첨금"
              value={formatCompactWon(winningTotal)}
              onClick={() => setFilter('won')}
            />
          </div>

          {isManageMode ? (
            <ManageMetrics events={visibleEvents} totalAmount={winningTotal} />
          ) : null}

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

          {filter !== 'won' && platformOptions.length > 1 ? (
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

          {filter === 'won' ? (
            <WinningLedger
              events={visibleEvents}
              totalAmount={winningTotal}
              onMetaChange={updateWinningMeta}
            />
          ) : filter === 'done' ? (
            <CompletedManagementList
              events={visibleEvents}
              isLoading={isLoading}
              onResultChange={updateResult}
            />
          ) : filter === 'todayAnnouncement' ? (
            <ResultManagementList
              events={visibleEvents}
              isLoading={isLoading}
              onAnnouncementChange={updateAnnouncement}
              onResultChange={updateResult}
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
      if (event.status === 'done' && event.resultStatus === 'unknown') {
        acc.resultUnknown += 1;
      }
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
      resultUnknown: 0,
      todayAnnouncement: 0,
      won: 0,
      lost: 0,
      skipped: 0,
    },
  );
}

export default App;
