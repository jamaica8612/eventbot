import { useMemo, useState } from 'react';
import { resultLabels, statusLabels } from '../constants.js';
import { getPrizeDisplay, matchesSearchQuery, sortSearchEvents } from '../utils/eventModel.js';
import { ApplyLink } from './EventCards.jsx';

export function EventSearch({ events, isLoading, onStatusChange }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const matchingEvents = useMemo(
    () =>
      sortSearchEvents(events)
        .filter((event) => matchesSearchScope(event, scope))
        .filter((event) => matchesSearchQuery(event, query)),
    [events, query, scope],
  );
  const scopes = useMemo(() => buildSearchScopes(events), [events]);

  return (
    <div className="search-board">
      <label className="search-box">
        <span>검색어</span>
        <input
          autoFocus
          type="search"
          placeholder="브랜드, 경품, 플랫폼, 본문 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="filter-chips" aria-label="검색 범위">
        {scopes.map((item) => (
          <button
            key={item.value}
            type="button"
            className={scope === item.value ? 'is-active' : ''}
            onClick={() => setScope(item.value)}
          >
            {item.label} <strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className="search-result-head">
        <span>{query.trim() ? `"${query.trim()}"` : '전체'} 결과</span>
        <strong>{matchingEvents.length}개</strong>
      </div>

      <div className="search-list">
        {matchingEvents.length > 0 ? (
          matchingEvents.map((event) => (
            <SearchResultRow key={event.id} event={event} onStatusChange={onStatusChange} />
          ))
        ) : (
          <p className="empty-message">
            {isLoading ? '이벤트를 불러오는 중입니다.' : '검색 결과가 없습니다.'}
          </p>
        )}
      </div>
    </div>
  );
}

function SearchResultRow({ event, onStatusChange }) {
  const applyHref = event.applyUrl ?? event.url;
  const resultStatus = event.resultStatus ?? 'unknown';

  return (
    <article className="search-row">
      <header className="search-row-meta">
        <span>{event.platform}</span>
        <span>{statusLabels[event.status] ?? event.status}</span>
        {event.status === 'done' ? <span>{resultLabels[resultStatus]}</span> : null}
      </header>
      <strong>{event.title}</strong>
      <p>{getPrizeDisplay(event)}</p>
      <div className="search-row-actions">
        {applyHref ? <ApplyLink className="manage-link" url={applyHref} label="참여하기" /> : null}
        {event.status !== 'done' ? (
          <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
            참여완료
          </button>
        ) : null}
        {event.status !== 'done' ? (
          <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
            제외
          </button>
        ) : null}
      </div>
    </article>
  );
}

function buildSearchScopes(events) {
  return [
    { value: 'all', label: '전체', count: events.length },
    {
      value: 'ready',
      label: '대기',
      count: events.filter((event) => event.status === 'ready' || event.status === 'later').length,
    },
    { value: 'done', label: '응모함', count: events.filter((event) => event.status === 'done').length },
    { value: 'won', label: '당첨', count: events.filter((event) => event.resultStatus === 'won').length },
  ];
}

function matchesSearchScope(event, scope) {
  if (scope === 'ready') return event.status === 'ready' || event.status === 'later';
  if (scope === 'done') return event.status === 'done';
  if (scope === 'won') return event.resultStatus === 'won';
  return true;
}
