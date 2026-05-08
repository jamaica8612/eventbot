import { useMemo, useState } from 'react';
import { receiptLabels, resultLabels } from '../constants.js';
import {
  getAnnouncementStatus,
  getPrizeDisplay,
  getTodayDeadlineMatch,
  sortInboxEvents,
  sortTodayDeadlineEvents,
} from '../utils/eventModel.js';
import { formatDate, formatWon, parsePrizeAmount } from '../utils/format.js';
import { AnnouncementPanel, ApplyLink } from './EventCards.jsx';

const deadlineFilters = [
  { value: 'all', label: '전체' },
  { value: 'homepage', label: '홈페이지' },
  { value: 'youtube', label: '유튜브' },
  { value: 'instagram', label: '인스타' },
  { value: 'efficient', label: '고효율' },
  { value: 'home', label: '집에서' },
];

const inboxFilters = [
  { value: 'all', label: '전체' },
  { value: 'check', label: '발표확인' },
  { value: 'won', label: '당첨' },
  { value: 'unreceived', label: '미수령' },
  { value: 'lost', label: '미당첨' },
];

export function TodayDeadlineList({ events, isLoading, onStatusChange }) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const sortedEvents = useMemo(() => sortTodayDeadlineEvents(events), [events]);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        deadlineFilters.map((filter) => [
          filter.value,
          sortedEvents.filter((event) => matchesDeadlineView(event, filter.value)).length,
        ]),
      ),
    [sortedEvents],
  );
  const visibleEvents = useMemo(
    () => sortedEvents.filter((event) => matchesDeadlineView(event, selectedFilter)),
    [selectedFilter, sortedEvents],
  );

  if (events.length === 0) {
    return (
      <p className="empty-message">
        {isLoading ? '이벤트를 불러오는 중입니다.' : '오늘 마감 이벤트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="deadline-board">
      <div className="filter-chips" aria-label="오늘마감 보기">
        {deadlineFilters.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={selectedFilter === filter.value ? 'is-active' : ''}
            onClick={() => setSelectedFilter(filter.value)}
          >
            {filter.label} <strong>{filterCounts[filter.value]}</strong>
          </button>
        ))}
      </div>

      <div className="deadline-list">
        {visibleEvents.length > 0 ? (
          visibleEvents.map((event) => (
            <TodayDeadlineRow key={event.id} event={event} onStatusChange={onStatusChange} />
          ))
        ) : (
          <p className="empty-message">이 조건에 맞는 오늘 마감 이벤트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function TodayDeadlineRow({ event, onStatusChange }) {
  const match = getTodayDeadlineMatch(event);
  const applyHref = event.applyUrl ?? event.url;
  const prize = getPrizeDisplay(event);

  return (
    <article className="deadline-row">
      <header className="deadline-row-head">
        <strong>{event.title}</strong>
        <span>{event.bookmarkCount ?? 0}명</span>
      </header>
      <p>{prize}</p>
      <div className="deadline-meta">
        <span>{event.platform}</span>
        <span>{event.clickScore ?? 0}점</span>
        <span>{event.estimatedSeconds ?? '-'}초</span>
        <span>{match.isExact ? '오늘 마감' : '마감 확인 필요'}</span>
      </div>
      <div className="deadline-actions">
        {applyHref ? <ApplyLink className="manage-link" url={applyHref} label="참여하기" /> : null}
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'later')}>
          집에서
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
          제외
        </button>
      </div>
    </article>
  );
}

function matchesDeadlineView(event, view) {
  const platform = String(event.platform ?? '').toLowerCase();
  if (view === 'homepage') return /홈페이지|home|web/.test(platform);
  if (view === 'youtube') return /유튜브|youtube/.test(platform);
  if (view === 'instagram') return /인스타|instagram/.test(platform);
  if (view === 'efficient') return (event.clickScore ?? 0) >= 70;
  if (view === 'home') return event.actionType === 'home';
  return true;
}

export function EventInbox({
  events,
  isLoading,
  totalAmount,
  onAnnouncementChange,
  onResultChange,
  onMetaChange,
}) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const sortedEvents = useMemo(() => sortInboxEvents(events), [events]);
  const inboxCounts = useMemo(() => buildInboxCounts(sortedEvents), [sortedEvents]);
  const visibleEvents = useMemo(
    () => sortedEvents.filter((event) => matchesInboxView(event, selectedFilter)),
    [selectedFilter, sortedEvents],
  );

  if (events.length === 0) {
    return (
      <p className="empty-message">
        {isLoading ? '이벤트를 불러오는 중입니다.' : '응모함에 담긴 이벤트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="inbox-board">
      <div className="inbox-summary">
        <div>
          <span>응모완료</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>발표확인</span>
          <strong>{inboxCounts.check}</strong>
        </div>
        <div>
          <span>미수령</span>
          <strong>{inboxCounts.unreceived}</strong>
        </div>
        <div>
          <span>당첨금</span>
          <strong>{formatWon(totalAmount)}</strong>
        </div>
      </div>

      <div className="filter-chips" aria-label="응모함 보기">
        {inboxFilters.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={selectedFilter === filter.value ? 'is-active' : ''}
            onClick={() => setSelectedFilter(filter.value)}
          >
            {filter.label} <strong>{inboxCounts[filter.value]}</strong>
          </button>
        ))}
      </div>

      <div className="inbox-list">
        {visibleEvents.length > 0 ? (
          visibleEvents.map((event) => (
            <InboxRow
              key={event.id}
              event={event}
              onAnnouncementChange={onAnnouncementChange}
              onResultChange={onResultChange}
              onMetaChange={onMetaChange}
            />
          ))
        ) : (
          <p className="empty-message">이 조건에 맞는 응모 내역이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function InboxRow({ event, onAnnouncementChange, onResultChange, onMetaChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const resultStatus = event.resultStatus ?? 'unknown';
  const announcement = getAnnouncementStatus(event);
  const prize = event.prizeTitle || getPrizeDisplay(event);
  const amount = parsePrizeAmount(event.prizeAmount);
  const isWon = resultStatus === 'won';
  const isCheckTarget =
    resultStatus === 'unknown' && ['overdue', 'today'].includes(announcement.state);

  return (
    <article
      className={`inbox-row inbox-row-${resultStatus} inbox-announcement-${announcement.state}${
        isCheckTarget ? ' is-check-target' : ''
      }`}
    >
      <button
        type="button"
        className="manage-edit-text-button"
        onClick={() => setIsEditing((value) => !value)}
      >
        수정
      </button>
      <header className="manage-row-meta">
        <time>{formatDate(event.participatedAt)}</time>
        <span>{event.platform}</span>
        <span className={`announcement-state announcement-state-${announcement.state}`}>
          {announcement.label}
        </span>
        <span className={`result-badge result-${resultStatus}`}>{resultLabels[resultStatus]}</span>
      </header>
      <strong className="manage-row-title">{event.title}</strong>
      <p className="manage-row-prize">
        <span>경품</span> {prize}
      </p>

      {isCheckTarget ? (
        <p className="inbox-attention">
          {announcement.state === 'overdue'
            ? '발표일이 지났습니다. 결과 확인을 먼저 처리하세요.'
            : '오늘 발표 예정입니다. 확인 후 결과를 기록하세요.'}
        </p>
      ) : null}

      {isWon ? (
        <div className="inbox-winning-meta">
          <span>{amount > 0 ? formatWon(amount) : '금액 미입력'}</span>
          <span>{receiptLabels[event.receiptStatus ?? 'unclaimed']}</span>
          <span>{event.winningMemo || '메모 없음'}</span>
        </div>
      ) : null}

      {isWon ? (
        <div className="ledger-quick-receipt" aria-label={`${event.title} 수령 상태 빠른 변경`}>
          <button
            type="button"
            className={event.receiptStatus === 'received' ? 'is-received' : ''}
            onClick={() => onMetaChange(event.id, { receiptStatus: 'received' })}
          >
            수령완료
          </button>
          <button
            type="button"
            className={event.receiptStatus !== 'received' ? 'is-unreceived' : ''}
            onClick={() => onMetaChange(event.id, { receiptStatus: 'unclaimed' })}
          >
            미수령
          </button>
        </div>
      ) : null}

      <div className="manage-result-actions manage-actions-three">
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
        {event.originalUrl || event.url ? (
          <ApplyLink
            className="manage-link"
            url={event.originalUrl ?? event.url}
            label="확인"
          />
        ) : null}
      </div>

      {isEditing ? (
        <div className="manage-edit-panel inbox-edit-panel">
          <AnnouncementPanel event={event} onAnnouncementChange={onAnnouncementChange} />
          {isWon ? (
            <>
              <label className="prize-title-field">
                <span>상품명</span>
                <input
                  value={event.prizeTitle ?? prize}
                  onChange={(changeEvent) =>
                    onMetaChange(event.id, { prizeTitle: changeEvent.target.value })
                  }
                />
              </label>
              <label className="amount-field">
                <span>금액</span>
                <input
                  inputMode="decimal"
                  placeholder="예: 1만 5000"
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
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function buildInboxCounts(events) {
  return {
    all: events.length,
    check: events.filter((event) => matchesInboxView(event, 'check')).length,
    won: events.filter((event) => matchesInboxView(event, 'won')).length,
    unreceived: events.filter((event) => matchesInboxView(event, 'unreceived')).length,
    lost: events.filter((event) => matchesInboxView(event, 'lost')).length,
  };
}

function matchesInboxView(event, view) {
  const announcement = getAnnouncementStatus(event);
  if (view === 'check') {
    return event.resultStatus === 'unknown' && ['overdue', 'today'].includes(announcement.state);
  }
  if (view === 'won') return event.resultStatus === 'won';
  if (view === 'unreceived') {
    return event.resultStatus === 'won' && event.receiptStatus !== 'received';
  }
  if (view === 'lost') return event.resultStatus === 'lost';
  return true;
}
