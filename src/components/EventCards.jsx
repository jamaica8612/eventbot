import { resultLabels, statusActions, statusLabels } from '../constants.js';
import {
  buildSourceFacts,
  buildUserContentLines,
  buildPreviewLines,
  getAnnouncementStatus,
  getPrizeDisplay,
} from '../utils/eventModel.js';
import { EventBodyToggle } from './EventBodyToggle.jsx';
import { AnnouncementPanel, ApplyLink } from './EventShared.jsx';

export function EventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  if (filter === 'ready' || filter === 'todayDeadline' || filter === 'later') {
    return <ReadyEventCard event={event} onStatusChange={onStatusChange} />;
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

function ReadyEventCard({ event, onStatusChange }) {
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);
  const applyHref = event.applyUrl ?? event.url;

  return (
    <article className="event-card now-card">
      <div className="score-row">
        <span>{event.platform}</span>
        <strong>{Number.isFinite(event.bookmarkCount) ? `${event.bookmarkCount}명` : '대기'}</strong>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />

      <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />

      <div className="quick-actions now-actions" aria-label={`${event.title} 처리`}>
        {applyHref ? (
          <ApplyLink className="apply-link primary-apply" url={applyHref} label="참여하기" />
        ) : null}
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
        </button>
        <button
          type="button"
          onClick={() => onStatusChange(event.id, event.status === 'later' ? 'ready' : 'later')}
        >
          {event.status === 'later' ? '대기로' : '임시저장'}
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
          제외
        </button>
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
        <span>{event.platform}</span>
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
        {getDeadlineDisplay(event) ? <span>{getDeadlineDisplay(event)}</span> : null}
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
  const announcement = event.resultAnnouncementDate || event.resultAnnouncementText;

  if (!deadline && !announcement) {
    return null;
  }

  return (
    <div className="schedule-row" aria-label={`${event.title} 일정`}>
      {deadline ? <span>마감 {deadline}</span> : null}
      {announcement ? <span>발표 {event.resultAnnouncementDate || event.resultAnnouncementText}</span> : null}
    </div>
  );
}

function getDeadlineDisplay(event) {
  const value = event.deadlineDate || event.deadlineText || event.due || '';
  return value === '상세 확인 필요' ? '' : value;
}
