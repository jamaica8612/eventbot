import { useEffect, useMemo, useState } from 'react';
import { initialEvents } from './data/events.js';
import { loadCrawledEvents } from './storage/crawledEventStorage.js';
import {
  applyStoredStatuses,
  saveEventResult,
  saveEventStatus,
  saveWinningMeta,
} from './storage/eventStatusStorage.js';
import {
  hasSupabaseConfig,
  loadSupabaseEvents,
  updateSupabaseEventState,
} from './storage/supabaseEventStorage.js';

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
  { value: 'allReady', label: '전체', countKey: 'allReady' },
  { value: 'quick', label: '현장', countKey: 'quick' },
  { value: 'later', label: '나중', countKey: 'later' },
  { value: 'resultUnknown', label: '결과', countKey: 'resultUnknown' },
  { value: 'won', label: '당첨', countKey: 'won' },
];

const secondaryFilters = [
  { value: 'done', label: '참여함', countKey: 'done' },
  { value: 'lost', label: '미당첨', countKey: 'lost' },
  { value: 'skipped', label: '제외', countKey: 'skipped' },
];

const filterTitles = {
  allReady: '아직 판단할 이벤트',
  quick: '현장에서 바로 딸각',
  later: '집에서 볼 이벤트',
  done: '참여한 이벤트',
  resultUnknown: '결과 확인할 이벤트',
  won: '당첨 관리',
  lost: '미당첨',
  skipped: '제외한 이벤트',
};

function App() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('allReady');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadRemoteEvents().then((remoteEvents) => {
      if (!isMounted) {
        return;
      }

      setEvents(remoteEvents.length > 0 ? remoteEvents : applyStoredStatuses(initialEvents));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const counts = useMemo(
    () =>
      events.reduce(
        (acc, event) => {
          if (event.status === 'ready') acc.allReady += 1;
          if (event.status === 'ready' && event.effort === 'quick') acc.quick += 1;
          if (event.status === 'later') acc.later += 1;
          if (event.status === 'done') acc.done += 1;
          if (event.status === 'done' && event.resultStatus === 'unknown') {
            acc.resultUnknown += 1;
          }
          if (event.resultStatus === 'won') acc.won += 1;
          if (event.resultStatus === 'lost') acc.lost += 1;
          if (event.status === 'skipped') acc.skipped += 1;
          return acc;
        },
        {
          allReady: 0,
          quick: 0,
          later: 0,
          done: 0,
          resultUnknown: 0,
          won: 0,
          lost: 0,
          skipped: 0,
        },
      ),
    [events],
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)),
    [events, filter],
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
    updateSupabaseEventState(
      eventId,
      buildStatusPatch(currentEvent, status, changedAt),
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
    updateSupabaseEventState(eventId, {
      status: 'done',
      resultStatus,
      participatedAt,
      resultCheckedAt: changedAt,
      receiptStatus: currentEvent?.receiptStatus ?? 'unclaimed',
    });

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

  const updateWinningMeta = (eventId, meta) => {
    saveWinningMeta(eventId, meta);
    updateSupabaseEventState(eventId, {
      status: 'done',
      resultStatus: 'won',
      ...meta,
    });

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId
          ? {
              ...event,
              status: 'done',
              resultStatus: 'won',
              ...meta,
              prizeAmount:
                typeof meta.prizeAmount === 'string'
                  ? meta.prizeAmount.replace(/[^\d]/g, '')
                  : event.prizeAmount,
            }
          : event,
      ),
    );
  };

  return (
    <>
      <main className="app-shell">
        <section className="app-hero" aria-labelledby="page-title">
          <div>
            <p className="app-kicker">EVENT CLICK</p>
            <h1 id="page-title">이벤트 딸각</h1>
            <p className="overview-copy">
              지금 할 것만 빠르게 보고, 나머지는 집에서 관리합니다.
            </p>
          </div>

          <div className="summary-grid" aria-label="핵심 현황">
            <SummaryItem
              active={filter === 'allReady'}
              label="판단 대기"
              value={counts.allReady}
              onClick={() => setFilter('allReady')}
            />
            <SummaryItem
              active={filter === 'quick'}
              label="현장 딸각"
              value={counts.quick}
              onClick={() => setFilter('quick')}
            />
            <SummaryItem
              active={filter === 'resultUnknown'}
              label="결과 확인"
              value={counts.resultUnknown}
              onClick={() => setFilter('resultUnknown')}
            />
            <SummaryItem
              active={filter === 'won'}
              label="당첨금"
              value={formatCompactWon(winningTotal)}
              onClick={() => setFilter('won')}
            />
          </div>
        </section>

        <section className="work-panel" aria-label="이벤트 관리">
          <div className="toolbar">
            <div>
              <p className="section-label">현재 보기</p>
              <h2>{filterTitles[filter]}</h2>
            </div>
            <span className="list-count">{visibleEvents.length}개</span>
          </div>

          <FilterChips
            counts={counts}
            filters={secondaryFilters}
            selectedFilter={filter}
            onSelect={setFilter}
          />

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
                    onResultChange={updateResult}
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
  if (filter === 'allReady') return event.status === 'ready';
  if (filter === 'quick') return event.status === 'ready' && event.effort === 'quick';
  if (filter === 'resultUnknown') {
    return event.status === 'done' && event.resultStatus === 'unknown';
  }
  if (filter === 'won') return event.resultStatus === 'won';
  if (filter === 'lost') return event.resultStatus === 'lost';

  return event.status === filter;
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

function FilterChips({ counts, filters, selectedFilter, onSelect }) {
  return (
    <div className="filter-chips" aria-label="보조 분류">
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
    </div>
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

function WinningLedger({ events, totalAmount, onMetaChange }) {
  return (
    <div className="winning-ledger">
      <div className="ledger-summary">
        <div>
          <span>당첨</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>입력 금액</span>
          <strong>{formatWon(totalAmount)}</strong>
        </div>
        <div>
          <span>수령완료</span>
          <strong>
            {events.filter((event) => event.receiptStatus === 'received').length}
          </strong>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="ledger-table" role="table" aria-label="당첨 관리 목록">
          <div className="ledger-head" role="row">
            <span>날짜</span>
            <span>당첨내역</span>
            <span>금액</span>
            <span>상태</span>
          </div>
          {events.map((event) => (
            <WinningRow key={event.id} event={event} onMetaChange={onMetaChange} />
          ))}
        </div>
      ) : (
        <p className="empty-message">아직 당첨으로 표시한 이벤트가 없습니다.</p>
      )}
    </div>
  );
}

function WinningRow({ event, onMetaChange }) {
  return (
    <article className="ledger-row">
      <time>{formatDate(event.resultCheckedAt ?? event.participatedAt)}</time>
      <div className="ledger-title">
        <strong>{event.title}</strong>
        <span>{event.source}</span>
      </div>
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
    </article>
  );
}

function EventCard({ event, onResultChange, onStatusChange }) {
  const resultStatus = event.resultStatus ?? 'unknown';

  return (
    <article className="event-card">
      <div className="card-topline">
        <span className={`tag tag-${event.effort}`}>{event.effortLabel}</span>
        <span className={`status status-${event.status}`}>
          {statusLabels[event.status]}
        </span>
      </div>

      <h3>{event.title}</h3>
      <EventSourceSummary event={event} />

      {event.status === 'done' ? (
        <div className={`result-badge result-${resultStatus}`}>
          {resultLabels[resultStatus]}
        </div>
      ) : null}

      {event.applyUrl || event.url ? (
        <a className="apply-link" href={event.applyUrl ?? event.url} target="_self">
          참여하기
        </a>
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

function EventSourceSummary({ event }) {
  const facts = [
    event.platform,
    Number.isFinite(event.bookmarkCount) ? `저장 ${event.bookmarkCount}` : null,
    Number.isFinite(event.rank) ? `목록 ${event.rank}위` : null,
  ].filter(Boolean);
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
