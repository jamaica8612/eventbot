import { useMemo, useState } from 'react';
import { receiptLabels, resultLabels } from '../constants.js';
import {
  getAnnouncementStatus,
  getPrizeDisplay,
  sortInboxEvents,
} from '../utils/eventModel.js';
import { getUpcomingDeadlineMatch } from '../utils/deadlineModel.js';
import { formatDate, formatWon, parsePrizeAmount } from '../utils/format.js';
import { EventCard } from './EventCards.jsx';
import { AnnouncementPanel, ApplyLink } from './EventShared.jsx';
import { GifticonVault } from './GifticonVault.jsx';
import { PlatformBadge } from './PlatformBadge.jsx';

const deadlineFilters = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
  { value: 'week', label: '7일 이내' },
  { value: 'unknown', label: '마감일 미확인' },
];

const inboxFilters = [
  { value: 'all', label: '미확인' },
  { value: 'check', label: '오늘발표' },
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
  const deadlineFocus = [
    { label: '오늘 마감', value: filterCounts.today },
    { label: '내일 마감', value: filterCounts.tomorrow },
    { label: '7일 이내', value: filterCounts.week },
  ];

  if (events.length === 0) {
    return (
      <p className="empty-message">
        {isLoading ? '이벤트를 불러오는 중입니다.' : '마감일을 확인할 이벤트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="deadline-board">
      <section className="deadline-focus-panel">
        <div>
          <span>DEADLINE QUEUE</span>
          <strong>{filterCounts.all}</strong>
          <p>마감이 가까운 이벤트를 먼저 처리하세요.</p>
        </div>
        <div className="deadline-focus-strip">
          {deadlineFocus.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                onSelectFilter(item.label === '오늘 마감' ? 'today' : item.label === '내일 마감' ? 'tomorrow' : 'week')
              }
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </section>

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
  onCreateManualWinning,
  onNotice,
}) {
  const [isGifticonOpen, setIsGifticonOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const sortedEvents = useMemo(() => sortInboxEvents(events), [events]);
  const inboxCounts = useMemo(() => buildInboxCounts(sortedEvents), [sortedEvents]);
  const attentionCounts = useMemo(() => buildInboxAttentionCounts(sortedEvents), [sortedEvents]);
  const winRate = useMemo(() => getWinRateLabel(sortedEvents), [sortedEvents]);
  const visibleEvents = useMemo(
    () => sortedEvents.filter((event) => matchesInboxView(event, selectedFilter)),
    [selectedFilter, sortedEvents],
  );

  if (isGifticonOpen) {
    return <GifticonVault onClose={() => setIsGifticonOpen(false)} onNotice={onNotice} />;
  }

  if (events.length === 0) {
    return (
      <div className="inbox-board">
        <div className="inbox-command-grid">
          <InboxGifticonEntry onOpen={() => setIsGifticonOpen(true)} />
          <ManualWinningEntry
            isOpen={isManualOpen}
            onToggle={() => setIsManualOpen((value) => !value)}
            onCreate={onCreateManualWinning}
            onNotice={onNotice}
          />
        </div>
        <p className="empty-message">
          {isLoading ? '이벤트를 불러오는 중입니다.' : '응모함에 담긴 이벤트가 없습니다.'}
        </p>
      </div>
    );
  }

  return (
    <div className="inbox-board">
      <section className="inbox-hero-panel">
        <div>
          <span>PRIZE LEDGER</span>
          <strong>{formatWon(totalAmount)}</strong>
          <p>당첨, 발표 확인, 미수령을 한 화면에서 정리합니다.</p>
        </div>
        <div className="inbox-hero-actions">
          <button type="button" onClick={() => setIsManualOpen(true)}>
            빠진 당첨 추가
          </button>
          <button type="button" onClick={() => setIsGifticonOpen(true)}>
            기프티콘 공유함
          </button>
        </div>
      </section>

      <div className="inbox-command-grid">
        <InboxGifticonEntry onOpen={() => setIsGifticonOpen(true)} />
        <ManualWinningEntry
          isOpen={isManualOpen}
          onToggle={() => setIsManualOpen((value) => !value)}
          onCreate={onCreateManualWinning}
          onNotice={onNotice}
        />
      </div>

      <div className="inbox-summary">
        <InboxSummaryCard label="응모완료" value={events.length} />
        <InboxSummaryCard label="오늘발표" value={inboxCounts.check} attention={attentionCounts.check > 0} />
        <InboxSummaryCard label="미수령" value={inboxCounts.unreceived} attention={attentionCounts.unreceived > 0} />
        <InboxSummaryCard label="당첨" value={inboxCounts.won} />
        <InboxSummaryCard label="당첨률" value={winRate} />
        <InboxSummaryCard label="당첨금" value={formatWon(totalAmount)} />
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
        <div className="inbox-list-head" aria-hidden="true">
          <span>응모일</span>
          <span>이벤트</span>
          <span>발표/결과</span>
          <span>경품</span>
          <span>관리</span>
        </div>
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

function InboxSummaryCard({ label, value, attention = false }) {
  return (
    <div className={attention ? 'is-attention' : ''}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InboxGifticonEntry({ onOpen }) {
  return (
    <div className="inbox-gifticon-entry">
      <div>
        <span>가족 공유</span>
        <strong>기프티콘 공유함</strong>
      </div>
      <button type="button" onClick={onOpen}>
        열기
      </button>
    </div>
  );
}

function ManualWinningEntry({ isOpen, onToggle, onCreate, onNotice }) {
  const [form, setForm] = useState({
    title: '',
    prizeTitle: '',
    prizeAmount: '',
    participatedAt: '',
    resultCheckedAt: new Date().toISOString().slice(0, 10),
    receiptStatus: 'unclaimed',
    memo: '',
    url: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      onNotice?.({ type: 'warning', message: '이벤트명이나 받은 곳을 입력해주세요.' });
      return;
    }
    setIsSaving(true);
    try {
      await onCreate?.(form);
      setForm({
        title: '',
        prizeTitle: '',
        prizeAmount: '',
        participatedAt: '',
        resultCheckedAt: new Date().toISOString().slice(0, 10),
        receiptStatus: 'unclaimed',
        memo: '',
        url: '',
      });
      onNotice?.({ type: 'success', message: '빠진 당첨 내역을 추가했습니다.' });
    } catch (error) {
      onNotice?.({ type: 'warning', message: error.message || '수기 당첨 입력에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className={`manual-winning-panel${isOpen ? ' is-open' : ''}`}>
      <button type="button" className="manual-winning-toggle" onClick={onToggle}>
        <span>
          <strong>빠진 당첨 추가</strong>
          <small>기프티콘이 왔는데 이벤트가 없을 때</small>
        </span>
        <b>{isOpen ? '닫기' : '입력'}</b>
      </button>

      {isOpen ? (
        <form className="manual-winning-form" onSubmit={handleSubmit}>
          <label>
            <span>이벤트명 / 받은 곳</span>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="예: 카카오톡 채널 이벤트"
            />
          </label>
          <label>
            <span>경품명</span>
            <input
              value={form.prizeTitle}
              onChange={(event) => updateField('prizeTitle', event.target.value)}
              placeholder="예: 스타벅스 아메리카노"
            />
          </label>
          <label>
            <span>금액</span>
            <input
              inputMode="numeric"
              value={form.prizeAmount}
              onChange={(event) => updateField('prizeAmount', event.target.value)}
              placeholder="예: 4500"
            />
          </label>
          <label>
            <span>당첨 확인일</span>
            <input
              type="date"
              value={form.resultCheckedAt}
              onChange={(event) => updateField('resultCheckedAt', event.target.value)}
            />
          </label>
          <label>
            <span>응모일</span>
            <input
              type="date"
              value={form.participatedAt}
              onChange={(event) => updateField('participatedAt', event.target.value)}
            />
          </label>
          <label>
            <span>수령 상태</span>
            <select
              value={form.receiptStatus}
              onChange={(event) => updateField('receiptStatus', event.target.value)}
            >
              <option value="unclaimed">미수령</option>
              <option value="received">수령완료</option>
            </select>
          </label>
          <label className="manual-winning-wide">
            <span>링크</span>
            <input
              value={form.url}
              onChange={(event) => updateField('url', event.target.value)}
              placeholder="선택 입력"
            />
          </label>
          <label className="manual-winning-wide">
            <span>메모</span>
            <input
              value={form.memo}
              onChange={(event) => updateField('memo', event.target.value)}
              placeholder="기프티콘 번호, 받은 날짜, 문의내용 등"
            />
          </label>
          <button type="submit" disabled={isSaving}>
            당첨함에 추가
          </button>
        </form>
      ) : null}
    </section>
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
  const handleDelete = () => {
    if (window.confirm('이 응모 기록을 응모함에서 삭제할까요?')) {
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
        {event.raw?.manualWinning ? <p className="inbox-attention inbox-manual-attention">수기입력</p> : null}
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
        <div className="inbox-top-actions">
          <button
            type="button"
            className="manage-edit-text-button"
            onClick={() => setIsEditing((value) => !value)}
          >
            수정
          </button>
          <button type="button" className="inbox-delete-button" onClick={handleDelete}>
            삭제
          </button>
        </div>

        <div className="manage-result-actions manage-actions-three">
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
          {event.originalUrl || event.url ? (
            <ApplyLink
              className="manage-link"
              url={event.originalUrl ?? event.url}
              label="확인"
            />
          ) : null}
        </div>

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
  if (view === 'won') return event.resultStatus === 'won';
  if (view === 'unreceived') {
    return event.resultStatus === 'won' && event.receiptStatus !== 'received';
  }
  if (view === 'lost') return event.resultStatus === 'lost';
  return event.resultStatus === 'unknown';
}

function getWinRateLabel(events) {
  const decidedEvents = events.filter((event) => ['won', 'lost'].includes(event.resultStatus));
  if (decidedEvents.length === 0) return '-';
  const wonCount = decidedEvents.filter((event) => event.resultStatus === 'won').length;
  return `${Math.round((wonCount / decidedEvents.length) * 100)}%`;
}
