import { useState } from 'react';
import { resultLabels, statusActions, statusLabels } from '../constants.js';
import {
  buildSourceFacts,
  buildUserContentLines,
  buildPreviewLines,
  getAnnouncementStatus,
  getPrizeDisplay,
  hasCrawledBody,
} from '../utils/eventModel.js';

export function EventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  if (filter === 'now') {
    return <NowEventCard event={event} onStatusChange={onStatusChange} />;
  }
  if (filter === 'home') {
    return <HomeEventCard event={event} onStatusChange={onStatusChange} />;
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

export function ApplyLink({ className, url, label = '참여하기' }) {
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export function AnnouncementPanel({ event, onAnnouncementChange }) {
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

function EventBodyToggle({ event, lines, facts }) {
  const [isBodyOpen, setIsBodyOpen] = useState(false);
  const [loadedTranscriptLines, setLoadedTranscriptLines] = useState([]);
  const [transcriptStatus, setTranscriptStatus] = useState('idle');
  const [transcriptError, setTranscriptError] = useState('');
  const originalHref = event.originalUrl ?? event.url;
  const savedTranscriptLines = buildYoutubeTranscriptLines(event);
  const youtubeTranscriptLines = savedTranscriptLines.length > 0 ? savedTranscriptLines : loadedTranscriptLines;
  const youtubeLink = buildYoutubeLinks(event)[0];
  const canFetchYoutubeTranscript = Boolean(youtubeLink && savedTranscriptLines.length === 0);

  async function handleYoutubeTranscriptFetch(clickEvent) {
    clickEvent.stopPropagation();
    if (!youtubeLink || transcriptStatus === 'loading') return;

    setTranscriptStatus('loading');
    setTranscriptError('');
    try {
      const response = await fetch(`/api/youtube-transcript?url=${encodeURIComponent(youtubeLink)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '유튜브 스크립트를 가져오지 못했습니다.');
      }
      setLoadedTranscriptLines(payload.lines ?? []);
      setTranscriptStatus('done');
    } catch (error) {
      setTranscriptError(error.message || '유튜브 스크립트를 가져오지 못했습니다.');
      setTranscriptStatus('failed');
    }
  }

  // 본문 수집이 막힌 경우(Cloudflare 등)에는 토글을 펼쳐도 안내 문구뿐이라
  // 토글 대신 "원문에서 확인" 안내 카드를 보여준다.
  if (!hasCrawledBody(event)) {
    return (
      <div className="event-body-empty">
        <p>본문은 슈퍼투데이 사이트에서 직접 확인하세요.</p>
        {originalHref ? (
          <a
            className="event-body-original"
            href={originalHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            원문 열기
          </a>
        ) : null}
      </div>
    );
  }

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
          {canFetchYoutubeTranscript ? (
            <button
              type="button"
              className="youtube-transcript-button"
              onClick={handleYoutubeTranscriptFetch}
              disabled={transcriptStatus === 'loading'}
            >
              {transcriptStatus === 'loading' ? '스크립트 가져오는 중' : '스크립트 가져오기'}
            </button>
          ) : null}
          {transcriptError ? <p className="youtube-transcript-error">{transcriptError}</p> : null}
          {youtubeTranscriptLines.length > 0 ? (
            <div className="youtube-transcript">
              <strong>유튜브 스크립트</strong>
              {youtubeTranscriptLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
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

function buildYoutubeTranscriptLines(event) {
  const transcripts = event.youtubeTranscripts ?? event.raw?.youtubeTranscripts ?? [];
  return transcripts
    .filter((transcript) => transcript?.status === 'ok')
    .flatMap((transcript) => transcript.lines ?? transcript.text?.split(/\n+/) ?? [])
    .map((line) => String(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildYoutubeLinks(event) {
  const raw = event.raw ?? {};
  return [event.applyUrl, event.url, event.originalUrl, ...(raw.externalLinks ?? [])]
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .filter((url) => extractYoutubeVideoId(url));
}

function extractYoutubeVideoId(url) {
  const value = String(url ?? '');
  return (
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    value.match(/youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1] ??
    ''
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

function NowEventCard({ event, onStatusChange }) {
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);
  const applyHref = event.applyUrl ?? event.url;

  return (
    <article className="event-card now-card">
      <div className="score-row">
        <span>{event.platform}</span>
        <strong>{event.clickScore}점</strong>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />

      <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />

      {applyHref ? (
        <ApplyLink className="apply-link primary-apply" url={applyHref} label="참여하기" />
      ) : null}

      <div className="quick-actions now-actions" aria-label={`${event.title} 빠른 처리`}>
        <button type="button" onClick={() => onStatusChange(event.id, 'later')}>
          집에서
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
        </button>
        <button type="button" onClick={() => onStatusChange(event.id, 'skipped')}>
          제외
        </button>
      </div>
    </article>
  );
}

function HomeEventCard({ event, onStatusChange }) {
  const userContentLines = buildUserContentLines(event);
  const sourceFacts = buildSourceFacts(event);
  const applyHref = event.applyUrl ?? event.url;

  return (
    <article className="event-card home-card">
      <div className="score-row">
        <span>{event.platform}</span>
        <strong>{event.clickScore}점</strong>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />
      <p className="decision-reason">{event.decisionReason}</p>
      <EventBodyToggle event={event} lines={userContentLines} facts={sourceFacts} />

      {applyHref ? (
        <ApplyLink className="apply-link primary-apply" url={applyHref} label="참여하기" />
      ) : null}

      <div className="quick-actions home-actions" aria-label={`${event.title} 집 처리`}>
        <button type="button" onClick={() => onStatusChange(event.id, 'done')}>
          참여완료
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
        <span className={`tag tag-${event.effort}`}>{event.effortLabel}</span>
        <span className={`status status-${event.status}`}>{statusLabels[event.status]}</span>
      </div>

      <h3>{event.title}</h3>
      <EventScheduleMeta event={event} />
      <p className="decision-reason">{event.decisionReason}</p>
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
