import { useState } from 'react';
import { resultLabels } from '../constants.js';
import { getAnnouncementStatus, getPrizeDisplay } from '../utils/eventModel.js';
import { formatAnnouncementDate, formatDate } from '../utils/format.js';
import { AnnouncementPanel, ApplyLink } from './EventCards.jsx';

export function CompletedManagementList({ events, isLoading, onResultChange }) {
  if (events.length === 0) {
    return (
      <p className="empty-message">
        {isLoading ? '이벤트를 불러오는 중입니다.' : '완료된 이벤트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="manage-list completed-list" role="table" aria-label="완료 이벤트 관리">
      <div className="manage-head completed-head" role="row">
        <span>참여일</span>
        <span>이벤트</span>
        <span>플랫폼</span>
        <span>발표일</span>
        <span>결과</span>
        <span>처리</span>
        <span>링크</span>
      </div>
      {events.map((event) => (
        <CompletedListItem key={event.id} event={event} onResultChange={onResultChange} />
      ))}
    </div>
  );
}

function CompletedListItem({ event, onResultChange }) {
  const resultStatus = event.resultStatus ?? 'unknown';

  return (
    <article className="manage-row completed-row" role="row">
      <time>{formatDate(event.participatedAt)}</time>
      <strong>{event.title}</strong>
      <span>{event.platform}</span>
      <span>{formatAnnouncementDate(event)}</span>
      <span className={`result-badge result-${resultStatus}`}>{resultLabels[resultStatus]}</span>
      <div className="manage-result-actions">
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
      {event.originalUrl || event.url ? (
        <ApplyLink className="manage-link" url={event.originalUrl ?? event.url} label="다시보기" />
      ) : (
        <span>-</span>
      )}
    </article>
  );
}

export function ResultManagementList({ events, isLoading, onAnnouncementChange, onResultChange }) {
  if (events.length === 0) {
    return (
      <p className="empty-message">
        {isLoading ? '이벤트를 불러오는 중입니다.' : '확인할 결과가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="manage-list result-list" role="table" aria-label="결과 확인 관리">
      <div className="manage-head result-head" role="row">
        <span>상태</span>
        <span>이벤트</span>
        <span>상품</span>
        <span>결과 처리</span>
        <span>수정</span>
      </div>
      {events.map((event) => (
        <ResultListItem
          key={event.id}
          event={event}
          onAnnouncementChange={onAnnouncementChange}
          onResultChange={onResultChange}
        />
      ))}
    </div>
  );
}

function ResultListItem({ event, onAnnouncementChange, onResultChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const resultStatus = event.resultStatus ?? 'unknown';
  const announcement = getAnnouncementStatus(event);

  return (
    <article className="manage-row result-manage-row" role="row">
      <span className={`announcement-state announcement-state-${announcement.state}`}>
        {announcement.label}
      </span>
      <strong>{event.title}</strong>
      <span>{getPrizeDisplay(event)}</span>
      <div className="manage-result-actions">
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
      <button
        type="button"
        className="manage-edit-button"
        onClick={() => setIsEditing((value) => !value)}
      >
        수정
      </button>
      {event.originalUrl || event.url ? (
        <ApplyLink
          className="manage-link"
          url={event.originalUrl ?? event.url}
          label="발표 확인"
        />
      ) : null}
      {isEditing ? (
        <div className="manage-edit-panel">
          <AnnouncementPanel event={event} onAnnouncementChange={onAnnouncementChange} />
        </div>
      ) : null}
    </article>
  );
}
