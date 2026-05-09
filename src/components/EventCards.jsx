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
import { getAuthToken } from '../storage/passcodeAuthStorage.js';

const YOUTUBE_CONTEXT_TIMEOUT_MS = 95000;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');

export function EventCard({ event, filter, onResultChange, onAnnouncementChange, onStatusChange }) {
  if (filter === 'ready') {
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

export function ApplyLink({ className, url, label = '참여하기' }) {
  function handleApplyClick(clickEvent) {
    clickEvent.stopPropagation();
    if (!url) {
      clickEvent.preventDefault();
      return;
    }
  }

  return (
    <a
      className={className}
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleApplyClick}
    >
      {label}
    </a>
  );
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const didCopy = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!didCopy) {
    throw new Error('copy failed');
  }
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
  const [youtubeContext, setYoutubeContext] = useState(null);
  const [transcriptStatus, setTranscriptStatus] = useState('idle');
  const [transcriptError, setTranscriptError] = useState('');
  const [copyStatus, setCopyStatus] = useState('idle');
  const [copiedCandidateIndex, setCopiedCandidateIndex] = useState(-1);
  const [areCandidatesVisible, setAreCandidatesVisible] = useState(true);
  const [manualCopyText, setManualCopyText] = useState('');
  const originalHref = event.originalUrl ?? event.url;
  const youtubeLink = buildYoutubeLinks(event)[0];
  const canFetchYoutubeTranscript = isYoutubeEvent(event) && Boolean(youtubeLink);
  const commentMaterialText = buildYoutubeCommentMaterialText(event, youtubeContext);
  const hasCommentCandidates = Boolean(youtubeContext?.commentCandidates?.length);

  async function handleYoutubeTranscriptFetch(clickEvent) {
    clickEvent.stopPropagation();
    if (hasCommentCandidates) {
      setAreCandidatesVisible(true);
      setTranscriptError('');
      return;
    }
    if (!youtubeLink || transcriptStatus === 'loading') return;

    setTranscriptStatus('loading');
    setTranscriptError('');
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), YOUTUBE_CONTEXT_TIMEOUT_MS);
    try {
      const endpoint = getYoutubeContextEndpoint();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getYoutubeContextHeaders(endpoint),
        signal: abortController.signal,
        body: JSON.stringify({
          url: youtubeLink,
          eventInfo: buildCommentEventInfo(event),
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || '유튜브 댓글자료를 가져오지 못했습니다.');
      }
      setYoutubeContext(payload);
      setAreCandidatesVisible(true);
      setTranscriptError('');
      setTranscriptStatus('done');
    } catch (error) {
      const message =
        error.name === 'AbortError'
          ? '댓글 후보 생성이 너무 오래 걸려 중단했습니다. 잠시 뒤 다시 시도하세요.'
          : error.message || '유튜브 댓글자료를 가져오지 못했습니다.';
      setTranscriptError(message);
      setTranscriptStatus('failed');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function handleCopyYoutubeMaterial(clickEvent) {
    clickEvent.stopPropagation();
    if (!commentMaterialText) return;

    try {
      await copyTextToClipboard(commentMaterialText);
      setManualCopyText('');
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1600);
    } catch {
      setManualCopyText(commentMaterialText);
      setCopyStatus('failed');
    }
  }

  async function handleCopyCandidate(clickEvent, candidateText, index) {
    clickEvent.stopPropagation();
    if (!candidateText) return;

    try {
      await copyTextToClipboard(candidateText);
      setManualCopyText('');
      setCopiedCandidateIndex(index);
      window.setTimeout(() => setCopiedCandidateIndex(-1), 1600);
    } catch {
      setManualCopyText(candidateText);
      setCopiedCandidateIndex(-2);
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
              onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
              onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
              onClick={handleYoutubeTranscriptFetch}
              disabled={transcriptStatus === 'loading'}
            >
              {transcriptStatus === 'loading'
                ? '댓글 후보 생성 중'
                : hasCommentCandidates
                  ? '댓글 후보 보기'
                  : '댓글 후보 만들기'}
            </button>
          ) : null}
          {transcriptError ? <p className="youtube-transcript-error">{transcriptError}</p> : null}
          {youtubeContext ? (
            <div className="youtube-context">
              <strong>영상 정보</strong>
              <p>영상 제목: {youtubeContext.title || '-'}</p>
              <p>채널: {youtubeContext.channelName || '-'}</p>
              {youtubeContext.description ? <p>설명: {youtubeContext.description}</p> : null}
              {youtubeContext.keywords?.length ? <p>키워드: {youtubeContext.keywords.join(', ')}</p> : null}
              <button
                type="button"
                onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                onClick={handleCopyYoutubeMaterial}
              >
                {copyStatus === 'copied' ? '복사됨' : '전체 자료 복사'}
              </button>
              {copyStatus === 'failed' ? (
                <p className="youtube-transcript-error">복사에 실패했습니다. 아래 텍스트를 직접 복사하세요.</p>
              ) : null}
            </div>
          ) : null}
          {areCandidatesVisible && hasCommentCandidates ? (
            <div className="comment-candidates">
              <div className="comment-candidates-head">
                <strong>댓글 후보</strong>
                <span>복사해서 필요한 부분만 다듬어 쓰세요</span>
              </div>
              {youtubeContext.commentCandidates.map((candidate, index) => (
                <div key={index} className="comment-candidate">
                  {candidate.style ? (
                    <p className="comment-candidate-style">{candidate.style}</p>
                  ) : null}
                  <p className="comment-candidate-text">{candidate.text}</p>
                  <button
                    type="button"
                    className="comment-candidate-copy"
                    onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                    onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                    onClick={(clickEvent) => handleCopyCandidate(clickEvent, candidate.text, index)}
                  >
                    {copiedCandidateIndex === index ? '복사됨' : '이 댓글 복사'}
                  </button>
                </div>
              ))}
              {copiedCandidateIndex === -2 ? (
                <p className="youtube-transcript-error">복사에 실패했습니다. 아래 텍스트를 직접 복사하세요.</p>
              ) : null}
            </div>
          ) : youtubeContext?.commentCandidatesError ? (
            <p className="youtube-transcript-error">
              댓글 후보 생성 실패: {youtubeContext.commentCandidatesError}
            </p>
          ) : null}
          {manualCopyText ? (
            <textarea
              className="manual-copy-box"
              value={manualCopyText}
              readOnly
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                clickEvent.currentTarget.select();
              }}
            />
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

function getYoutubeContextEndpoint() {
  if (API_BASE_URL) return `${API_BASE_URL}/api/youtube-transcript`;
  if (shouldUseSupabaseFunction()) return `${SUPABASE_URL}/functions/v1/youtube-transcript`;
  return '/api/youtube-transcript';
}

function shouldUseSupabaseFunction() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getYoutubeContextHeaders(endpoint) {
  const headers = { 'content-type': 'application/json' };
  if (SUPABASE_URL && endpoint.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    headers['x-eventbot-token'] = getAuthToken();
  }
  return headers;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const rawText = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error('댓글 후보 API 응답을 읽지 못했습니다.');
    }
  }

  const isStaticFallback =
    rawText.trim().startsWith('<') || contentType.includes('text/html');
  if (isStaticFallback) {
    throw new Error(
      '댓글 후보 API가 연결되지 않았습니다. 로컬 dev 서버나 Vercel API 배포에서 사용해 주세요.',
    );
  }

  throw new Error(rawText.slice(0, 160) || '댓글 후보 API 응답 형식이 올바르지 않습니다.');
}

function buildYoutubeLinks(event) {
  const raw = event.raw ?? {};
  return [event.applyUrl, event.url, event.originalUrl, ...(raw.externalLinks ?? [])]
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .filter((url) => extractYoutubeVideoId(url));
}

function isYoutubeEvent(event) {
  const platform = String(event.platform ?? '').toLowerCase();
  return platform.includes('유튜브') || platform.includes('youtube');
}

function extractYoutubeVideoId(url) {
  const value = String(url ?? '');
  return (
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    value.match(/youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1] ??
    ''
  );
}

function buildYoutubeCommentMaterialText(event, context) {
  if (!context) return '';

  const eventInfo = buildCommentEventInfo(event);
  const originalLines = eventInfo.bodyLines;
  const commentLines = (context.comments ?? [])
    .slice(0, 20)
    .map((comment) => `- 좋아요 ${comment.likes ?? 0}: ${comment.text}`);
  const candidateLines = (context.commentCandidates ?? []).map(
    (candidate, index) => `${index + 1}. ${candidate.style ? `${candidate.style}: ` : ''}${candidate.text}`,
  );

  return [
    '[댓글 후보 생성용 유튜브 이벤트 자료]',
    '',
    '아래 정보를 바탕으로 이벤트 댓글 후보를 만들어줘.',
    'AI가 쓴 설명문처럼 쓰지 말고, 영상과 이벤트 조건을 이해한 사람이 바로 댓글창에 남기는 말투로 작성해줘.',
    '',
    '[이벤트 정보]',
    `제목: ${eventInfo.title}`,
    `플랫폼: ${eventInfo.platform}`,
    `마감: ${eventInfo.deadline || '-'}`,
    `발표: ${eventInfo.announcement || '-'}`,
    `경품: ${eventInfo.prize || '-'}`,
    `참여 링크: ${eventInfo.applyUrl || '-'}`,
    `참여 힌트: ${eventInfo.participationHints.join(', ') || '-'}`,
    '',
    '[유튜브 영상 정보]',
    `영상 제목: ${context.title || '-'}`,
    `채널: ${context.channelName || '-'}`,
    `영상 URL: ${context.url || '-'}`,
    `업로드일: ${context.publishDate || '-'}`,
    `영상 길이: ${formatDuration(context.lengthSeconds)}`,
    `조회수: ${formatNumber(context.viewCount)}`,
    `카테고리: ${context.category || '-'}`,
    `키워드: ${context.keywords?.length ? context.keywords.join(', ') : '-'}`,
    '',
    '[영상 설명]',
    context.description || '-',
    '',
    '[이벤트 본문]',
    originalLines.join('\n') || '-',
    '',
    '[인기 댓글 참고]',
    commentLines.join('\n') || '-',
    '',
    '[생성된 댓글 후보]',
    candidateLines.join('\n') || '-',
  ].join('\n');
}

function buildCommentEventInfo(event) {
  const bodyLines = buildUserContentLines(event).slice(0, 24);
  const text = [event.title, event.platform, event.prizeText, event.prizeTitle, ...bodyLines]
    .filter(Boolean)
    .join('\n');

  return {
    title: event.title,
    platform: event.platform,
    deadline: event.deadlineDate || event.deadlineText || event.due || '',
    announcement: event.resultAnnouncementDate || event.resultAnnouncementText || '',
    prize: event.prizeText || event.prizeTitle || '',
    applyUrl: event.applyUrl || event.url || '',
    bodyLines,
    participationHints: inferParticipationHints(text),
  };
}

function inferParticipationHints(text) {
  const hints = [];
  const rules = [
    [/구독|구독자/, '구독 언급 가능'],
    [/좋아요|추천/, '좋아요 참여 가능'],
    [/댓글|정답|이유|기대평|응원/, '댓글 조건 확인'],
    [/공유|리그램|스토리/, '공유 조건 확인'],
    [/친구|태그|소환/, '친구 태그 조건 확인'],
    [/퀴즈|정답|문제/, '정답형 댓글 가능'],
  ];

  for (const [pattern, hint] of rules) {
    if (pattern.test(text) && !hints.includes(hint)) {
      hints.push(hint);
    }
  }
  return hints.slice(0, 5);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
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

      {applyHref ? (
        <ApplyLink className="apply-link primary-apply" url={applyHref} label="참여하기" />
      ) : null}

      <div className="quick-actions now-actions" aria-label={`${event.title} 처리`}>
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
