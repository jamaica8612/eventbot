import { useState } from 'react';
import { resultLabels, statusActions, statusLabels } from '../constants.js';
import {
  buildSourceFacts,
  buildUserContentLines,
  buildPreviewLines,
  getAnnouncementStatus,
  getPrizeDisplay,
} from '../utils/eventModel.js';
import { getLocalToday, parseLocalDate } from '../utils/format.js';
import { EventBodyToggle } from './EventBodyToggle.jsx';
import { AnnouncementPanel, ApplyLink, DeadlinePanel } from './EventShared.jsx';
import { PlatformBadge } from './PlatformBadge.jsx';

export function EventCard({
  event,
  filter,
  onResultChange,
  onAnnouncementChange,
  onDeadlineChange,
  onStatusChange,
}) {
  if (filter === 'ready' || filter === 'todayDeadline' || filter === 'later') {
    return (
      <ReadyEventCard
        event={event}
        onDeadlineChange={onDeadlineChange}
        onStatusChange={onStatusChange}
      />
    );
  }
  if (filter === 'todayAnnouncement') {
    return (
      <TodayAnnouncementCard
        event={event}
        onAnnouncementChange={onAnnouncementChange}
        onResultChange={onResultChange}
      />
    );
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

function ReadyEventCard({ event, onDeadlineChange, onStatusChange }) {
  const [isDeadlineEditing, setIsDeadlineEditing] = useState(false);
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);
  const applyHref = event.applyUrl ?? event.url;
  const totalWinnerCount = getTotalWinnerCount(event);
  const deadline = getDeadlineDisplay(event);
  const prize = getSchedulePrizeDisplay(event);
  const deadlineKind =
    deadline === '오늘마감'
      ? 'today'
      : deadline === '내일마감'
        ? 'tomorrow'
        : 'soon';
  const isFeatured = deadlineKind === 'today';
  const isLater = event.status === 'later';
  const isSkipped = event.status === 'skipped';

  return (
    <article className={`event-card v2-card v2-card-ready${isFeatured ? ' is-featured' : ''}`}>
      {isFeatured ? (
        <span className="v2-featured-ribbon">🔥 마감 임박</span>
      ) : null}

      <header className="v2-card-head">
        <PlatformBadge platform={event.platform} />
        <span className="v2-winner-count">
          당첨 <b>{Number.isFinite(totalWinnerCount) ? `${totalWinnerCount}명` : '대기'}</b>
        </span>
      </header>

      <h3 className="v2-card-title">{event.title}</h3>

      {deadline || prize ? (
        <div className="v2-chip-row">
          {deadline ? (
            <span className={`v2-chip v2-chip-${deadlineKind}`}>⏰ {deadline}</span>
          ) : null}
          {prize ? <span className="v2-chip v2-chip-prize">🎁 {prize}</span> : null}
        </div>
      ) : null}

      {isDeadlineEditing && onDeadlineChange ? (
        <DeadlinePanel event={event} onDeadlineChange={onDeadlineChange} />
      ) : null}

      <div className="v2-summary-box">
        <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />
      </div>

      <div className="v2-action-row" aria-label={`${event.title} 처리`}>
        {applyHref ? (
          <ApplyLink className="apply-link v2-primary-cta" url={applyHref} label="참여하러 가기 →" />
        ) : (
          <button type="button" className="v2-primary-cta" disabled>링크 없음</button>
        )}
        <button
          type="button"
          className="v2-icon-btn v2-icon-btn-done"
          title="참여완료"
          aria-label="참여완료"
          onClick={() => onStatusChange(event.id, 'done')}
        >
          ✓
        </button>
        <button
          type="button"
          className={`v2-icon-btn v2-icon-btn-later${isLater ? ' is-on' : ''}`}
          title={isLater ? '대기로' : '임시저장'}
          aria-label={isLater ? '대기로' : '임시저장'}
          onClick={() => onStatusChange(event.id, isLater ? 'ready' : 'later')}
        >
          {isLater ? '↩' : '☆'}
        </button>
        <button
          type="button"
          className={`v2-icon-btn v2-icon-btn-skip${isSkipped ? ' is-on' : ''}`}
          title="제외"
          aria-label="제외"
          onClick={() => onStatusChange(event.id, 'skipped')}
        >
          ×
        </button>
        {onDeadlineChange ? (
          <button
            type="button"
            className="v2-icon-btn v2-icon-btn-edit"
            title="마감 수정"
            aria-label="마감 수정"
            onClick={() => setIsDeadlineEditing((current) => !current)}
          >
            ✎
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TodayAnnouncementCard({ event, onAnnouncementChange, onResultChange }) {
  const resultStatus = event.resultStatus ?? 'unknown';
  const prize = getPrizeDisplay(event);

  return (
    <article className="event-card announcement-card">
      <div className="score-row">
        <PlatformBadge platform={event.platform} />
        <strong>{getAnnouncementStatus(event).label}</strong>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />

      <div className="prize-panel">
        <span>경품</span>
        <strong>{prize}</strong>
      </div>

      <AnnouncementPanel event={event} onAnnouncementChange={onAnnouncementChange} />

      {event.originalUrl || event.url ? (
        <ApplyLink
          className="apply-link"
          url={event.originalUrl ?? event.url}
          label="발표 확인"
        />
      ) : null}

      <div className="result-row" aria-label={`${event.title} 발표 결과 변경`}>
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
      </div>
    </article>
  );
}

function CompletedEventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  const resultStatus = event.resultStatus ?? 'unknown';
  const showAnnouncementPanel =
    filter === 'todayAnnouncement' && event.status === 'done' && resultStatus === 'unknown';
  const showCompletionActions = filter !== 'done';

  return (
    <article className="event-card">
      <div className="card-topline">
        <span className={`status status-${event.status}`}>{statusLabels[event.status]}</span>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />
      <EventSourceSummary event={event} />

      {event.status === 'done' ? (
        <div className={`result-badge result-${resultStatus}`}>{resultLabels[resultStatus]}</div>
      ) : null}

      {showAnnouncementPanel ? (
        <AnnouncementPanel event={event} onAnnouncementChange={onAnnouncementChange} />
      ) : null}

      {showCompletionActions && (event.applyUrl || event.url) ? (
        <ApplyLink className="apply-link" url={event.applyUrl ?? event.url} />
      ) : null}

      <div className="meta-row">
        <span>{event.source}</span>
        {getDeadlineDisplay(event) ? (
          <span className={getDeadlineClassName(event)}>{getDeadlineDisplay(event)}</span>
        ) : null}
      </div>

      {showCompletionActions ? (
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
      ) : null}

      {event.status === 'done' ? (
        <div className="result-row" aria-label={`${event.title} 참여 결과 변경`}>
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
        </div>
      ) : null}
    </article>
  );
}

function EventScheduleMeta({ event }) {
  const deadline = getDeadlineDisplay(event);
  const prize = getSchedulePrizeDisplay(event);

  if (!deadline && !prize) {
    return null;
  }

  return (
    <div className="schedule-row" aria-label={`${event.title} 일정`}>
      {deadline ? <span className={getDeadlineClassName(event)}>{deadline}</span> : null}
      {prize ? <span className="schedule-prize">{prize}</span> : null}
    </div>
  );
}

function getDeadlineDisplay(event) {
  const value = event.deadlineDate || event.deadlineText || event.due || '';
  if (!value || value === '\uC0C1\uC138 \uD655\uC778 \uD544\uC694') return '';

  const text = String(value).trim();
  if (
    new RegExp(
      '\\uC624\\uB298\\s*\\uB9C8\\uAC10|\\uAE08\\uC77C\\s*\\uB9C8\\uAC10|\\uB9C8\\uAC10\\s*\\uC624\\uB298|\\uC624\\uB298\\s*\\uC885\\uB8CC|\\uAE08\\uC77C\\s*\\uC885\\uB8CC',
    ).test(text)
  ) {
    return '\uC624\uB298\uB9C8\uAC10';
  }
  if (
    new RegExp(
      '\\uB0B4\\uC77C\\s*\\uB9C8\\uAC10|\\uB9C8\\uAC10\\s*\\uB0B4\\uC77C|\\uB0B4\\uC77C\\s*\\uC885\\uB8CC',
    ).test(text)
  ) {
    return '\uB0B4\uC77C\uB9C8\uAC10';
  }

  const date = parseLocalDate(event.deadlineDate || text);
  if (date) {
    const today = getLocalToday();
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return '\uC624\uB298\uB9C8\uAC10';
    if (diffDays === 1) return '\uB0B4\uC77C\uB9C8\uAC10';
  }

  return new RegExp('^\\uB9C8\\uAC10\\s*').test(text) ? text : `\uB9C8\uAC10 ${text}`;
}

function getDeadlineClassName(event) {
  const deadline = getDeadlineDisplay(event);
  if (deadline === '\uC624\uB298\uB9C8\uAC10') return 'deadline-chip deadline-today';
  if (deadline === '\uB0B4\uC77C\uB9C8\uAC10') return 'deadline-chip deadline-tomorrow';
  return 'deadline-chip';
}

function getSchedulePrizeDisplay(event) {
  const raw = event.raw ?? {};
  const directPrize = event.prizeText || event.prizeTitle || raw.prizeText || '';
  const prize = directPrize || getPrizeDisplay(event);
  if (!prize || /미수집|확인 필요|정보 미수집/i.test(prize)) return '';
  return String(prize)
    .replace(/^[\s🎁🎉🏆💝]+/u, '')
    .replace(/^(?:이벤트\s*)?(?:경품|상품|혜택|리워드|선물|경품태그)\s*[:：]?\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
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
  if (!match) return NaN;
  const afterLabel = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
  return parseCount(afterLabel);
}

function parseCount(value) {
  const match = String(value ?? '').match(/\d[\d,]*/);
  if (!match) return NaN;
  const count = Number.parseInt(match[0].replace(/,/g, ''), 10);
  return Number.isFinite(count) ? count : NaN;
}
