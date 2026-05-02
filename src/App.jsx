import { useEffect, useMemo, useState } from 'react';
import { initialEvents } from './data/events.js';
import { loadCrawledEvents } from './storage/crawledEventStorage.js';
import {
  applyStoredStatuses,
  saveEventAnnouncement,
  saveEventResult,
  saveEventStatus,
  saveWinningMeta,
} from './storage/eventStatusStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseEvents,
  updateSupabaseEventState,
} from './storage/supabaseEventStorage.js';
import { getFallbackDecision } from '../crawler/eventDecision/ruleDecision.js';

const statusLabels = {
  ready: '대기',
  later: '나중에',
  done: '참여함',
  skipped: '제외',
};

const resultLabels = {
  unknown: '결과 미확인',
  won: '당첨',
  lost: '미당첨',
};

const receiptLabels = {
  unclaimed: '미수령',
  requested: '수령요청',
  received: '수령완료',
};

const statusActions = [
  { value: 'later', label: '나중에' },
  { value: 'done', label: '참여완료' },
  { value: 'skipped', label: '제외' },
];

const primaryFilters = [
  { value: 'now', label: '지금', countKey: 'now' },
  { value: 'home', label: '집에서', countKey: 'home' },
  { value: 'done', label: '완료', countKey: 'done' },
  { value: 'todayAnnouncement', label: '오늘발표', countKey: 'todayAnnouncement' },
  { value: 'won', label: '당첨', countKey: 'won' },
];

const filterTitles = {
  now: '지금 바로 딸깍',
  home: '집에서 처리할 이벤트',
  done: '참여완료한 이벤트',
  todayAnnouncement: '오늘 당첨자 발표',
  won: '당첨 관리',
};

function App() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('now');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem('eventbotTheme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem('eventbotTheme', theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    loadRemoteEvents().then((remoteEvents) => {
      if (!isMounted) {
        return;
      }

      const nextEvents = remoteEvents.length > 0 ? remoteEvents : applyStoredStatuses(initialEvents);
      setEvents(nextEvents.map(enrichEvent));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setPlatformFilter('all');
  }, [filter]);

  const counts = useMemo(
    () =>
      events.reduce(
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
      ),
    [events],
  );

  const filteredByTabEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
  );

  const platformOptions = useMemo(
    () => buildPlatformOptions(filteredByTabEvents),
    [filteredByTabEvents],
  );

  const visibleEvents = useMemo(
    () => {
      const platformEvents =
        platformFilter === 'all'
          ? filteredByTabEvents
          : filteredByTabEvents.filter((event) => event.platform === platformFilter);

      return filter === 'todayAnnouncement'
        ? sortTodayAnnouncements(platformEvents)
        : platformEvents;
    },
    [filter, filteredByTabEvents, platformFilter],
  );

  const winningTotal = useMemo(
    () =>
      events
        .filter((event) => event.resultStatus === 'won')
        .reduce((total, event) => total + parsePrizeAmount(event.prizeAmount), 0),
    [events],
  );

  const updateStatus = (eventId, status) => {
    const changedAt = new Date().toISOString();
    const currentEvent = events.find((event) => event.id === eventId);
    saveEventStatus(eventId, status);
    persistEventState(
      eventId,
      buildStatusPatch(currentEvent, status, changedAt),
      setSyncError,
    );

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId ? applyStatusChange(event, status, changedAt) : event,
      ),
    );
  };

  const updateResult = (eventId, resultStatus) => {
    const changedAt = new Date().toISOString();
    const currentEvent = events.find((event) => event.id === eventId);
    const participatedAt = currentEvent?.participatedAt ?? changedAt;
    saveEventResult(eventId, resultStatus);
    persistEventState(
      eventId,
      {
        status: 'done',
        resultStatus,
        participatedAt,
        resultCheckedAt: changedAt,
        receiptStatus: currentEvent?.receiptStatus ?? 'unclaimed',
      },
      setSyncError,
    );

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: 'done',
              resultStatus,
              participatedAt: event.participatedAt ?? participatedAt,
              resultCheckedAt: changedAt,
              receiptStatus: event.receiptStatus ?? 'unclaimed',
            }
          : event,
      ),
    );
  };

  const updateAnnouncement = (eventId, meta) => {
    const currentEvent = events.find((event) => event.id === eventId);
    const participatedAt = currentEvent?.participatedAt ?? new Date().toISOString();
    saveEventAnnouncement(eventId, meta);
    persistEventState(
      eventId,
      {
        status: 'done',
        resultStatus: currentEvent?.resultStatus ?? 'unknown',
        participatedAt,
        ...meta,
      },
      setSyncError,
    );

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: 'done',
              resultStatus: event.resultStatus ?? 'unknown',
              participatedAt: event.participatedAt ?? participatedAt,
              ...meta,
            }
          : event,
      ),
    );
  };

  const updateWinningMeta = (eventId, meta) => {
    saveWinningMeta(eventId, meta);
    persistEventState(
      eventId,
      {
        status: 'done',
        resultStatus: 'won',
        ...meta,
      },
      setSyncError,
    );

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: 'done',
              resultStatus: 'won',
              ...meta,
              prizeTitle:
                typeof meta.prizeTitle === 'string' ? meta.prizeTitle : event.prizeTitle,
              prizeAmount:
                typeof meta.prizeAmount === 'string'
                  ? meta.prizeAmount.replace(/[^\d]/g, '')
                  : event.prizeAmount,
              winningMemo:
                typeof meta.winningMemo === 'string' ? meta.winningMemo : event.winningMemo,
            }
          : event,
      ),
    );
  };

  return (
    <>
      <main className="app-shell">
        <section className="app-hero" aria-labelledby="page-title">
          <div className="hero-top">
            <div className="hero-copy">
              <p className="app-kicker">EVENT CLICK</p>
              <h1 id="page-title">지금 딸깍</h1>
              <p className="overview-copy">
                한 손으로 보고 바로 누를 것만 남깁니다.
              </p>
            </div>
            <button
              type="button"
              className="theme-switch"
              aria-label="테마 변경"
              onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
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
              label="오늘발표"
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
              <h2>{filterTitles[filter]}</h2>
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
                  {isLoading ? '이벤트를 불러오는 중입니다.' : '지금 볼 이벤트가 없습니다.'}
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

async function loadRemoteEvents() {
  if (hasSupabaseConfig) {
    const supabaseEvents = await loadSupabaseEvents();
    if (supabaseEvents.length > 0) {
      return supabaseEvents;
    }
  }

  const crawledEvents = await loadCrawledEvents();
  return applyStoredStatuses(crawledEvents);
}

function persistEventState(eventId, patch, onError) {
  onError('');
  updateSupabaseEventState(eventId, patch)
    .then(() => onError(''))
    .catch(() => {
      onError('저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 눌러주세요.');
    });
}

function buildStatusPatch(event, status, changedAt) {
  if (status === 'done') {
    return {
      status,
      resultStatus: 'unknown',
      participatedAt: event?.participatedAt ?? changedAt,
    };
  }

  return {
    status,
    resultStatus: 'unknown',
    resultCheckedAt: null,
  };
}

function applyStatusChange(event, status, changedAt) {
  if (status === 'done') {
    return {
      ...event,
      status,
      resultStatus: event.resultStatus ?? 'unknown',
      participatedAt: event.participatedAt ?? changedAt,
    };
  }

  return {
    ...event,
    status,
    resultStatus: 'unknown',
    resultCheckedAt: null,
  };
}

function matchesFilter(event, filter) {
  if (filter === 'now') return event.status === 'ready' && event.actionType === 'now';
  if (filter === 'home') {
    return event.status === 'later' || (event.status === 'ready' && event.actionType === 'home');
  }
  if (filter === 'done') return event.status === 'done';
  if (filter === 'todayAnnouncement') return matchesTodayAnnouncement(event);
  if (filter === 'won') return event.resultStatus === 'won';

  return event.status === filter;
}

function matchesTodayAnnouncement(event) {
  if (event.status !== 'done' || event.resultStatus !== 'unknown') {
    return false;
  }

  const announcement = getAnnouncementStatus(event);
  return announcement.state !== 'future';
}

function buildPlatformOptions(events) {
  const counts = events.reduce((acc, event) => {
    const platform = event.platform || '기타 이벤트';
    acc.set(platform, (acc.get(platform) ?? 0) + 1);
    return acc;
  }, new Map());

  return [...counts.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((first, second) => second.count - first.count || first.platform.localeCompare(second.platform, 'ko-KR'));
}

function sortWinningEvents(events) {
  return [...events].sort(
    (first, second) => getWinningTime(second) - getWinningTime(first),
  );
}

function buildWinningMonthGroups(events) {
  const groups = events.reduce((acc, event) => {
    const groupKey = getWinningMonthKey(event);
    const currentGroup =
      acc.get(groupKey.key) ??
      {
        ...groupKey,
        events: [],
        totalAmount: 0,
        unreceivedCount: 0,
      };

    currentGroup.events.push(event);
    currentGroup.totalAmount += parsePrizeAmount(event.prizeAmount);
    if (event.receiptStatus !== 'received') {
      currentGroup.unreceivedCount += 1;
    }
    acc.set(groupKey.key, currentGroup);
    return acc;
  }, new Map());

  return [...groups.values()];
}

function getWinningMonthKey(event) {
  const value = getWinningDateValue(event);
  if (!value) {
    return { key: 'unknown', label: '날짜 미확인' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { key: 'unknown', label: '날짜 미확인' };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
  };
}

function getWinningTime(event) {
  const value = getWinningDateValue(event);
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getWinningDateValue(event) {
  return event.resultCheckedAt ?? event.participatedAt ?? null;
}

function enrichEvent(event) {
  const announcement = getFallbackAnnouncement(event);

  return {
    ...event,
    ...getFallbackDecision(event),
    resultAnnouncementDate: event.resultAnnouncementDate ?? announcement.date,
    resultAnnouncementText: event.resultAnnouncementText ?? announcement.text,
  };
}

function sortTodayAnnouncements(events) {
  const priority = {
    overdue: 0,
    today: 1,
    unknown: 2,
    future: 3,
  };

  return [...events].sort((first, second) => {
    const firstStatus = getAnnouncementStatus(first);
    const secondStatus = getAnnouncementStatus(second);
    const statusDiff = priority[firstStatus.state] - priority[secondStatus.state];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return getAnnouncementTime(first) - getAnnouncementTime(second);
  });
}

function getAnnouncementStatus(event) {
  const date = parseLocalDate(event.resultAnnouncementDate);
  if (!date) {
    return { state: 'unknown', label: event.resultAnnouncementText || '발표일 미정' };
  }

  const today = getLocalToday();
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { state: 'overdue', label: `${Math.abs(diffDays)}일 지남` };
  }

  if (diffDays === 0) {
    return { state: 'today', label: '오늘 발표' };
  }

  return { state: 'future', label: `${formatDate(date.toISOString())} 발표` };
}

function getAnnouncementTime(event) {
  const date = parseLocalDate(event.resultAnnouncementDate);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function getFallbackAnnouncement(event) {
  const text = buildAnnouncementSourceText(event);
  const announcementLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /당첨자?\s*발표|발표\s*일|결과\s*발표|당첨\s*확인/i.test(line));

  if (!announcementLine) {
    return { date: '', text: '' };
  }

  return {
    date: extractAnnouncementDate(announcementLine),
    text: announcementLine.slice(0, 80),
  };
}

function buildAnnouncementSourceText(event) {
  const raw = event.raw ?? {};
  const parts = [
    event.title,
    event.deadlineText,
    event.due,
    event.memo,
    event.originalText,
    raw.originalText,
    raw.contentText,
    raw.bodyText,
    Array.isArray(event.originalLines) ? event.originalLines.join('\n') : '',
    Array.isArray(raw.originalLines) ? raw.originalLines.join('\n') : '',
  ];

  return parts.filter((part) => typeof part === 'string' && part.trim()).join('\n');
}

function extractAnnouncementDate(text) {
  const today = getLocalToday();
  const year = today.getFullYear();
  const normalizedText = text.replace(/\s+/g, ' ');
  const fullDateMatch = normalizedText.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);

  if (fullDateMatch) {
    return formatInputDate(Number(fullDateMatch[1]), Number(fullDateMatch[2]), Number(fullDateMatch[3]));
  }

  const monthDayMatch = normalizedText.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?/);
  if (monthDayMatch) {
    return formatInputDate(year, Number(monthDayMatch[1]), Number(monthDayMatch[2]));
  }

  return '';
}

function parseLocalDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatInputDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function SummaryItem({ active, label, value, onClick }) {
  return (
    <button
      type="button"
      className={`summary-item${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function BottomNav({ counts, filters, selectedFilter, onSelect }) {
  return (
    <nav className="bottom-nav" aria-label="주요 분류">
      {filters.map((item) => (
        <button
          key={item.value}
          type="button"
          className={selectedFilter === item.value ? 'is-active' : ''}
          onClick={() => onSelect(item.value)}
        >
          <span>{item.label}</span>
          <strong>{counts[item.countKey]}</strong>
        </button>
      ))}
    </nav>
  );
}

function DesktopNav({ counts, filters, selectedFilter, onSelect }) {
  return (
    <nav className="desktop-nav" aria-label="PC 주요 분류">
      {filters.map((item) => (
        <button
          key={item.value}
          type="button"
          className={selectedFilter === item.value ? 'is-active' : ''}
          onClick={() => onSelect(item.value)}
        >
          <span>{item.label}</span>
          <strong>{counts[item.countKey]}</strong>
        </button>
      ))}
    </nav>
  );
}

function WinningLedger({ events, totalAmount, onMetaChange }) {
  const [ledgerView, setLedgerView] = useState('latest');
  const sortedEvents = useMemo(() => sortWinningEvents(events), [events]);
  const monthlyGroups = useMemo(() => buildWinningMonthGroups(sortedEvents), [sortedEvents]);
  const unreceivedCount = events.filter((event) => event.receiptStatus !== 'received').length;

  return (
    <div className="winning-ledger">
      <div className="ledger-summary">
        <div>
          <span>총 당첨</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>입력 금액</span>
          <strong>{formatWon(totalAmount)}</strong>
        </div>
        <div>
          <span>미수령</span>
          <strong>{unreceivedCount}</strong>
        </div>
      </div>

      <div className="ledger-view-toggle" aria-label="당첨 장부 보기 전환">
        <button
          type="button"
          className={ledgerView === 'latest' ? 'is-active' : ''}
          onClick={() => setLedgerView('latest')}
        >
          최신순
        </button>
        <button
          type="button"
          className={ledgerView === 'monthly' ? 'is-active' : ''}
          onClick={() => setLedgerView('monthly')}
        >
          월별
        </button>
      </div>

      {events.length > 0 ? (
        ledgerView === 'monthly' ? (
          <div className="ledger-month-list">
            {monthlyGroups.map((group) => (
              <section className="ledger-month-group" key={group.key}>
                <div className="ledger-month-head">
                  <strong>{group.label}</strong>
                  <span>
                    {group.events.length}건 · {formatWon(group.totalAmount)} · 미수령 {group.unreceivedCount}
                  </span>
                </div>
                <div className="ledger-table" role="table" aria-label={`${group.label} 당첨 관리 목록`}>
                  {group.events.map((event) => (
                    <WinningRow key={event.id} event={event} onMetaChange={onMetaChange} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="ledger-table" role="table" aria-label="당첨 관리 목록">
            {sortedEvents.map((event) => (
              <WinningRow key={event.id} event={event} onMetaChange={onMetaChange} />
            ))}
          </div>
        )
      ) : (
        <p className="empty-message">아직 당첨으로 표시한 이벤트가 없습니다.</p>
      )}
    </div>
  );
}

function WinningRow({ event, onMetaChange }) {
  return (
    <article className="ledger-row">
      <div className="ledger-title-block">
        <time>{formatDate(getWinningDateValue(event))}</time>
        <div className="ledger-title">
          <strong>{event.title}</strong>
          <span>{event.source}</span>
        </div>
      </div>
      <label className="prize-title-field">
        <span>상품명</span>
        <input
          placeholder="예: 스타벅스 아메리카노"
          value={event.prizeTitle ?? ''}
          onChange={(changeEvent) =>
            onMetaChange(event.id, { prizeTitle: changeEvent.target.value })
          }
        />
      </label>
      <label className="amount-field">
        <span>금액</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={event.prizeAmount ?? ''}
          onChange={(changeEvent) =>
            onMetaChange(event.id, { prizeAmount: changeEvent.target.value })
          }
        />
      </label>
      <label className="receipt-field">
        <span>상태</span>
        <select
          value={event.receiptStatus ?? 'unclaimed'}
          onChange={(changeEvent) =>
            onMetaChange(event.id, { receiptStatus: changeEvent.target.value })
          }
        >
          {Object.entries(receiptLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="winning-memo-field">
        <span>메모</span>
        <input
          placeholder="수령 조건, 문의번호, 계정 등"
          value={event.winningMemo ?? ''}
          onChange={(changeEvent) =>
            onMetaChange(event.id, { winningMemo: changeEvent.target.value })
          }
        />
      </label>
    </article>
  );
}

function EventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  if (filter === 'now') {
    return <NowEventCard event={event} onStatusChange={onStatusChange} />;
  }

  if (filter === 'home') {
    return <HomeEventCard event={event} onStatusChange={onStatusChange} />;
  }

  return (
    <CompletedEventCard
      event={event}
      filter={filter}
      onResultChange={onResultChange}
      onAnnouncementChange={onAnnouncementChange}
      onStatusChange={onStatusChange}
    />
  );
}

function NowEventCard({ event, onStatusChange }) {
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);

  return (
    <article className="event-card now-card">
      <div className="score-row">
        <span>{event.platform}</span>
        <strong>{event.clickScore}점</strong>
      </div>

      <h3>{event.title}</h3>

      <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />

      <div className="quick-actions now-actions" aria-label={`${event.title} 빠른 처리`}>
        {event.applyUrl || event.url ? (
          <ApplyLink className="apply-link action-apply" url={event.applyUrl ?? event.url} />
        ) : null}
        <button type="button" onClick={() => onStatusChange(event.id, 'later')}>
          집에서 하기
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
          제외
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
        </button>
      </div>

    </article>
  );
}

function EventBodyToggle({ event, lines, facts }) {
  const [isBodyOpen, setIsBodyOpen] = useState(false);

  return (
    <div
      className={`event-body-toggle${isBodyOpen ? ' is-open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => setIsBodyOpen((current) => !current)}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          setIsBodyOpen((current) => !current);
        }
      }}
    >
      {isBodyOpen ? (
        <div className="event-body-expanded">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="event-body-facts" aria-label="원문 보조 정보">
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
            {event.originalUrl || event.url ? (
              <a
                href={event.originalUrl ?? event.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                원문 열기
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="event-body-preview">
          {lines.slice(0, 3).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplyLink({ className, url }) {
  const href = buildSamsungBrowserHref(url);
  const isIntent = href.startsWith('intent://');

  return (
    <a
      className={className}
      href={href}
      target={isIntent ? '_self' : '_blank'}
      rel={isIntent ? undefined : 'noopener noreferrer'}
    >
      참여하기
    </a>
  );
}

function buildSamsungBrowserHref(url) {
  if (!shouldPreferSamsungBrowser()) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return url;
    }

    const scheme = parsedUrl.protocol.replace(':', '');
    const hostAndPath = `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    const fallbackUrl = encodeURIComponent(parsedUrl.toString());

    return `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.sec.android.app.sbrowser;S.browser_fallback_url=${fallbackUrl};end`;
  } catch {
    return url;
  }
}

function shouldPreferSamsungBrowser() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

function HomeEventCard({ event, onStatusChange }) {
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);

  return (
    <article className="event-card home-card">
      <div className="score-row">
        <span>{event.platform}</span>
        <strong>{event.clickScore}점</strong>
      </div>

      <h3>{event.title}</h3>
      <p className="decision-reason">{event.decisionReason}</p>
      <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />

      <div className="quick-actions home-actions" aria-label={`${event.title} 집 처리`}>
        {event.applyUrl || event.url ? (
          <ApplyLink className="apply-link action-apply" url={event.applyUrl ?? event.url} />
        ) : null}
        <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
          제외
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
        </button>
      </div>
    </article>
  );
}

function CompletedEventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  const resultStatus = event.resultStatus ?? 'unknown';
  const showAnnouncementPanel =
    filter === 'todayAnnouncement' && event.status === 'done' && resultStatus === 'unknown';

  return (
    <article className="event-card">
      <div className="card-topline">
        <span className={`tag tag-${event.effort}`}>{event.effortLabel}</span>
        <span className={`status status-${event.status}`}>
          {statusLabels[event.status]}
        </span>
      </div>

      <h3>{event.title}</h3>
      <p className="decision-reason">{event.decisionReason}</p>
      <EventSourceSummary event={event} />

      {event.status === 'done' ? (
        <div className={`result-badge result-${resultStatus}`}>
          {resultLabels[resultStatus]}
        </div>
      ) : null}

      {showAnnouncementPanel ? (
        <AnnouncementPanel event={event} onAnnouncementChange={onAnnouncementChange} />
      ) : null}

      {event.applyUrl || event.url ? (
        <ApplyLink className="apply-link" url={event.applyUrl ?? event.url} />
      ) : null}

      <div className="meta-row">
        <span>{event.source}</span>
        <span>{event.due}</span>
      </div>

      <div className="action-row" aria-label={`${event.title} 상태 변경`}>
        {statusActions.map((action) => (
          <button
            key={action.value}
            type="button"
            className={event.status === action.value ? 'is-selected' : ''}
            onClick={() => onStatusChange(event.id, action.value)}
          >
            {action.label}
          </button>
        ))}
      </div>

      {event.status === 'done' ? (
        <div className="result-row" aria-label={`${event.title} 참여 결과 변경`}>
          <button
            type="button"
            className={resultStatus === 'won' ? 'is-won' : ''}
            onClick={() => onResultChange(event.id, 'won')}
          >
            당첨
          </button>
          <button
            type="button"
            className={resultStatus === 'lost' ? 'is-lost' : ''}
            onClick={() => onResultChange(event.id, 'lost')}
          >
            미당첨
          </button>
        </div>
      ) : null}
    </article>
  );
}

function AnnouncementPanel({ event, onAnnouncementChange }) {
  const announcement = getAnnouncementStatus(event);

  return (
    <section className={`announcement-panel announcement-${announcement.state}`}>
      <div>
        <span>발표관리</span>
        <strong>{announcement.label}</strong>
      </div>
      <label>
        <span>발표일</span>
        <input
          type="date"
          value={event.resultAnnouncementDate ?? ''}
          onChange={(changeEvent) =>
            onAnnouncementChange(event.id, {
              resultAnnouncementDate: changeEvent.target.value,
            })
          }
        />
      </label>
      <label>
        <span>메모</span>
        <input
          placeholder="예: 공지사항 확인, 문자 발표"
          value={event.resultAnnouncementText ?? ''}
          onChange={(changeEvent) =>
            onAnnouncementChange(event.id, {
              resultAnnouncementText: changeEvent.target.value,
            })
          }
        />
      </label>
    </section>
  );
}

function EventSourceSummary({ event }) {
  const facts = buildSourceFacts(event);
  const previewLines = buildPreviewLines(event, facts);

  return (
    <details className="source-summary">
      <summary>
        <span>{previewLines[0]}</span>
        <strong>더보기</strong>
      </summary>
      <div className="source-body">
        {previewLines.slice(1).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="fact-row" aria-label="수집한 원문 정보">
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </div>
    </details>
  );
}

function buildSourceFacts(event) {
  return [
    event.platform,
    Number.isFinite(event.bookmarkCount) ? `저장 ${event.bookmarkCount}` : null,
    Number.isFinite(event.rank) ? `목록 ${event.rank}위` : null,
  ].filter(Boolean);
}

function buildPreviewLines(event, facts) {
  if (Array.isArray(event.originalLines) && event.originalLines.length > 0) {
    return event.originalLines;
  }

  if (event.originalText) {
    return event.originalText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [
    event.originalTitle ?? event.title,
    facts.length > 0 ? facts.join(' · ') : event.memo,
    '상세 조건은 참여하기에서 확인합니다.',
  ];
}

function buildUserContentLines(event) {
  const raw = event.raw ?? {};
  const possibleLineSets = [
    event.originalLines,
    raw.originalLines,
    raw.contentLines,
    raw.bodyLines,
  ];

  for (const lines of possibleLineSets) {
    if (Array.isArray(lines) && lines.length > 0) {
      return normalizeContentLines(lines, event);
    }
  }

  const possibleText = [
    event.originalText,
    raw.originalText,
    raw.contentText,
    raw.bodyText,
    raw.detailText,
  ].find((value) => typeof value === 'string' && value.trim());

  if (possibleText) {
    return normalizeContentLines(possibleText.split(/\n+/), event);
  }

  return ['아직 상세 본문이 수집되지 않았습니다. 참여하기를 누르면 원문에서 확인할 수 있어요.'];
}

function normalizeContentLines(lines, event) {
  const title = String(event.originalTitle ?? event.title ?? '').trim();
  const normalized = lines
    .map((line) => String(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => line !== title)
    .filter((line, index, currentLines) => currentLines.indexOf(line) === index);

  return normalized.length > 0
    ? normalized.slice(0, 24)
    : ['아직 상세 본문이 수집되지 않았습니다. 참여하기를 누르면 원문에서 확인할 수 있어요.'];
}

function parsePrizeAmount(value) {
  return Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10) || 0;
}

function formatWon(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatCompactWon(value) {
  if (value >= 10000) {
    return `${Math.round(value / 10000).toLocaleString('ko-KR')}만`;
  }

  return `${value.toLocaleString('ko-KR')}`;
}

function formatSeconds(value) {
  if (value < 60) {
    return `${value}초`;
  }

  return `${Math.round(value / 60)}분`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export default App;
