import { useMemo, useState } from 'react';
import { receiptLabels, resultLabels } from '../constants.js';
import {
  buildSourceFacts,
  buildUserContentLines,
  getAnnouncementStatus,
  getPrizeDisplay,
  sortInboxEvents,
} from '../utils/eventModel.js';
import { getUpcomingDeadlineMatch } from '../utils/deadlineModel.js';
import { formatDate, formatWon, parsePrizeAmount } from '../utils/format.js';
import { EventCard } from './EventCards.jsx';
import { EventBodyToggle } from './EventBodyToggle.jsx';
import { AnnouncementPanel, ApplyLink } from './EventShared.jsx';
import { PlatformBadge } from './PlatformBadge.jsx';

const deadlineFilters = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
  { value: 'week', label: '7일 이내' },
  { value: 'unknown', label: '마감일 미확인' },
];

const inboxFilters = [
  { value: 'all', label: '전체' },
  { value: 'check', label: '확인필요' },
  { value: 'pending', label: '미확인' },
  { value: 'won', label: '당첨' },
  { value: 'unreceived', label: '미수령' },
  { value: 'lost', label: '미당첨' },
];

export function TodayDeadlineList({
  events,
  isLoading,
  selectedFilter,
  onSelectFilter,
  onDeadlineChange,
  onStatusChange,
}) {
  const sortedEvents = events;
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
        {isLoading ? '이벤트를 불러오는 중입니다.' : '마감일을 확인할 이벤트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="deadline-board">
      <div className="filter-chips" aria-label="마감일순 보기">
        {deadlineFilters.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={selectedFilter === filter.value ? 'is-active' : ''}
            onClick={() => onSelectFilter(filter.value)}
          >
            {filter.label} <strong>{filterCounts[filter.value]}</strong>
          </button>
        ))}
      </div>

      <div className="deadline-list">
        {visibleEvents.length > 0 ? (
          visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              filter="todayDeadline"
              onDeadlineChange={onDeadlineChange}
              onStatusChange={onStatusChange}
            />
          ))
        ) : (
          <p className="empty-message">이 조건에 맞는 마감 이벤트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function matchesDeadlineView(event, view) {
  const match = getUpcomingDeadlineMatch(event);
  if (view === 'today') return match.bucket === 'today';
  if (view === 'tomorrow') return match.bucket === 'tomorrow';
  if (view === 'week') return ['today', 'tomorrow', 'week'].includes(match.bucket);
  if (view === 'unknown') return match.bucket === 'unknown';
  return match.isMatch;
}

export function EventInbox({
  events,
  isLoading,
  selectedFilter,
  onSelectFilter,
  totalAmount,
  onAnnouncementChange,
  onResultChange,
  onMetaChange,
  onDelete,
}) {
  const sortedEvents = useMemo(() => sortInboxEvents(events), [events]);
  const inboxCounts = useMemo(() => buildInboxCounts(sortedEvents), [sortedEvents]);
  const attentionCounts = useMemo(() => buildInboxAttentionCounts(sortedEvents), [sortedEvents]);
  const winRate = useMemo(() => getWinRateLabel(sortedEvents), [sortedEvents]);
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
    <div className={`inbox-board inbox-view-${selectedFilter}`}>
      <div className="inbox-summary">
        <div>
          <span>응모완료</span>
          <strong>{events.length}</strong>
        </div>
        <div className={attentionCounts.check > 0 ? 'is-attention' : ''}>
          <span>확인필요</span>
          <strong>{inboxCounts.check}</strong>
        </div>
        <div className={`inbox-summary-unreceived${attentionCounts.unreceived > 0 ? ' is-attention' : ''}`}>
          <span>미수령</span>
          <strong>{inboxCounts.unreceived}</strong>
        </div>
        <div>
          <span>당첨률</span>
          <strong>{winRate}</strong>
        </div>
        <div>
          <span>당첨금</span>
          <strong>{formatWon(totalAmount)}</strong>
        </div>
      </div>

      <div className="inbox-priority-strip" aria-label="응모함 우선 확인">
        <button
          type="button"
          className={selectedFilter === 'check' ? 'is-active' : ''}
          onClick={() => onSelectFilter('check')}
        >
          발표 확인 <strong>{inboxCounts.check}</strong>
        </button>
        <button
          type="button"
          className={selectedFilter === 'unreceived' ? 'is-active' : ''}
          onClick={() => onSelectFilter('unreceived')}
        >
          수령 처리 <strong>{inboxCounts.unreceived}</strong>
        </button>
      </div>

      <div className="filter-chips" aria-label="응모함 보기">
        {inboxFilters.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={selectedFilter === filter.value ? 'is-active' : ''}
            onClick={() => onSelectFilter(filter.value)}
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
              onDelete={onDelete}
            />
          ))
        ) : (
          <p className="empty-message">이 조건에 맞는 응모 내역이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function InboxRow({ event, onAnnouncementChange, onResultChange, onMetaChange, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const resultStatus = event.resultStatus ?? 'unknown';
  const announcement = getAnnouncementStatus(event);
  const prize = event.prizeTitle || getPrizeDisplay(event);
  const amount = parsePrizeAmount(event.prizeAmount);
  const isWon = resultStatus === 'won';
  const isUnreceived = isWon && event.receiptStatus !== 'received';
  const isCheckTarget =
    resultStatus === 'unknown' && ['overdue', 'today'].includes(announcement.state);
  const originalUrl = getHttpOriginalUrl(event);
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);
  const showYoutubeTools = hasYoutubeLink(event);
  const handleRestoreToReady = () => {
    if (window.confirm('이 응모 기록을 대기 상태로 되돌릴까요?')) {
      onDelete(event.id);
    }
  };

  return (
    <article
      className={`inbox-row inbox-row-${resultStatus} inbox-announcement-${announcement.state}${
        isCheckTarget ? ' is-check-target' : ''
      }${
        isUnreceived ? ' is-unreceived-target' : ''
      }`}
    >
      <div className="inbox-date-cell">
        <time>{formatDate(event.participatedAt)}</time>
        <PlatformBadge platform={event.platform} />
      </div>

      <div className="inbox-title-cell">
        <strong className="manage-row-title">{event.title}</strong>
        {isCheckTarget ? (
          <p className="inbox-attention">
            {announcement.state === 'overdue'
              ? '발표일 지남'
              : '오늘 발표'}
          </p>
        ) : null}
        {isUnreceived ? <p className="inbox-attention inbox-receipt-attention">미수령</p> : null}
      </div>

      <div className="inbox-state-cell">
        <span className={`announcement-state announcement-state-${announcement.state}`}>
          {announcement.label}
        </span>
        <span className={`result-badge result-${resultStatus}`}>{resultLabels[resultStatus]}</span>
      </div>

      <div className="inbox-prize-cell">
        <span>{prize}</span>
        {isWon ? (
          <div className="inbox-winning-meta">
            <span>{amount > 0 ? formatWon(amount) : '금액 미입력'}</span>
            <span>{receiptLabels[event.receiptStatus ?? 'unclaimed']}</span>
          </div>
        ) : null}
      </div>

      <div className="inbox-action-cell">
        <div className="manage-result-actions inbox-result-actions" aria-label={`${event.title} 결과 변경`}>
          <button
            type="button"
            className={resultStatus === 'won' ? 'is-won' : ''}
            onClick={() => onResultChange(event.id, resultStatus === 'won' ? 'unknown' : 'won')}
          >
            당첨
          </button>
          <button
            type="button"
            className={resultStatus === 'lost' ? 'is-lost' : ''}
            onClick={() => onResultChange(event.id, resultStatus === 'lost' ? 'unknown' : 'lost')}
          >
            미당첨
          </button>
          {resultStatus !== 'unknown' ? (
            <button
              type="button"
              className="is-reset"
              onClick={() => onResultChange(event.id, 'unknown')}
            >
              미확인
            </button>
          ) : null}
          {originalUrl ? (
            <ApplyLink
              className="manage-link"
              url={originalUrl}
              label="원글"
            />
          ) : null}
        </div>

        {isWon ? (
          <div className="inbox-receipt-actions" aria-label={`${event.title} 수령 상태 빠른 변경`}>
            <button
              type="button"
              className={(event.receiptStatus ?? 'unclaimed') === 'unclaimed' ? 'is-unreceived' : ''}
              onClick={() => onMetaChange(event.id, { receiptStatus: 'unclaimed' })}
            >
              미수령
            </button>
            <button
              type="button"
              className={event.receiptStatus === 'requested' ? 'is-requested' : ''}
              onClick={() => onMetaChange(event.id, { receiptStatus: 'requested' })}
            >
              요청
            </button>
            <button
              type="button"
              className={event.receiptStatus === 'received' ? 'is-received' : ''}
              onClick={() => onMetaChange(event.id, { receiptStatus: 'received' })}
            >
              완료
            </button>
          </div>
        ) : null}

        <div className="inbox-secondary-actions">
          <button
            type="button"
            className="manage-edit-text-button"
            onClick={() => setIsEditing((value) => !value)}
          >
            수정
          </button>
          <button type="button" className="inbox-delete-button" onClick={handleRestoreToReady}>
            대기로
          </button>
        </div>
      </div>

      {showYoutubeTools ? (
        <div className="inbox-youtube-tools">
          <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />
        </div>
      ) : null}

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

function getHttpOriginalUrl(event) {
  const url = event.originalUrl || event.url;
  return /^https?:\/\//i.test(url ?? '') ? url : '';
}

function hasYoutubeLink(event) {
  const raw = event.raw ?? {};
  return [
    event.applyTargetUrl,
    raw.applyTargetUrl,
    event.applyUrl,
    event.url,
    event.originalUrl,
    ...(raw.externalLinks ?? []),
  ]
    .filter(Boolean)
    .some((url) =>
      /youtu\.be\/[A-Za-z0-9_-]{6,}|youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)[A-Za-z0-9_-]{6,}/i.test(
        String(url),
      ),
    );
}

function buildInboxCounts(events) {
  return {
    all: events.length,
    check: events.filter((event) => matchesInboxView(event, 'check')).length,
    pending: events.filter((event) => matchesInboxView(event, 'pending')).length,
    won: events.filter((event) => matchesInboxView(event, 'won')).length,
    unreceived: events.filter((event) => matchesInboxView(event, 'unreceived')).length,
    lost: events.filter((event) => matchesInboxView(event, 'lost')).length,
  };
}

function buildInboxAttentionCounts(events) {
  return {
    check: events.filter((event) => {
      const announcement = getAnnouncementStatus(event);
      return event.resultStatus === 'unknown' && ['overdue', 'today'].includes(announcement.state);
    }).length,
    unreceived: events.filter(
      (event) => event.resultStatus === 'won' && event.receiptStatus !== 'received',
    ).length,
  };
}

function matchesInboxView(event, view) {
  if (view === 'check') {
    const announcement = getAnnouncementStatus(event);
    return event.resultStatus === 'unknown' && ['overdue', 'today'].includes(announcement.state);
  }
  if (view === 'pending') return event.resultStatus === 'unknown';
  if (view === 'all') return true;
  if (view === 'won') return event.resultStatus === 'won';
  if (view === 'unreceived') {
    return event.resultStatus === 'won' && event.receiptStatus !== 'received';
  }
  if (view === 'lost') return event.resultStatus === 'lost';
  return true;
}

function getWinRateLabel(events) {
  const decidedEvents = events.filter((event) => ['won', 'lost'].includes(event.resultStatus));
  if (decidedEvents.length === 0) return '-';
  const wonCount = decidedEvents.filter((event) => event.resultStatus === 'won').length;
  return `${Math.round((wonCount / decidedEvents.length) * 100)}%`;
}
