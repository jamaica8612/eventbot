import './EventDetailContent.css';
import { useState } from 'react';
import {
  buildUserContentLines, hasCrawledBody,
  buildYoutubeLinks, normalizeSavedYoutubeContext,
  fetchYoutubeContextPayload, persistYoutubeContext,
  buildYoutubeCommentMaterialText, copyTextToClipboard,
  YOUTUBE_CONTEXT_TIMEOUT_MS, YOUTUBE_INFO_TIMEOUT_MS,
} from '../lib/youtubeCard.js';
import { Button, Tag, Inline, Stack, Card, Divider } from './primitives.jsx';

/* ============================================================
   핵심 3기능
   1) 본문 펼치기 (3줄 프리뷰 ↔ 24줄 전체)
   2) 유튜브 정보수집 / 댓글 만들기 (실제 /api/youtube-transcript 호출)
   3) 추천 댓글 후보 + 클립보드 복사
   ============================================================ */

export function EventDetailContent({ event }) {
  const [isBodyOpen, setIsBodyOpen] = useState(false);
  const [youtubeContext, setYoutubeContext] = useState(
    () => normalizeSavedYoutubeContext(event.youtubeContext),
  );
  const [transcriptStatus, setTranscriptStatus] = useState('idle');
  const [infoStatus, setInfoStatus] = useState('idle');
  const [transcriptError, setTranscriptError] = useState('');
  const [copyStatus, setCopyStatus] = useState('idle');
  const [copiedCandidateIndex, setCopiedCandidateIndex] = useState(-1);
  const [areCandidatesVisible, setAreCandidatesVisible] = useState(true);
  const [manualCopyText, setManualCopyText] = useState('');

  const lines = (buildUserContentLines(event) ?? []).slice(0, 24);
  const youtubeLink = buildYoutubeLinks(event)[0];
  const canFetchYoutubeTranscript = Boolean(youtubeLink);
  const hasCommentCandidates = Boolean(youtubeContext?.commentCandidates?.length);
  const originalHref = event.originalUrl ?? event.url;

  async function handleYoutubeInfoFetch() {
    if (!youtubeLink || infoStatus === 'loading') return;
    setInfoStatus('loading');
    setTranscriptError('');
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), YOUTUBE_INFO_TIMEOUT_MS);
    try {
      const payload = await fetchYoutubeContextPayload({ event, mode: 'context', signal: ctrl.signal });
      setYoutubeContext(payload);
      persistYoutubeContext(event.id, payload);
      setAreCandidatesVisible(false);
      const material = buildYoutubeCommentMaterialText(event, payload);
      try {
        await copyTextToClipboard(material);
        setManualCopyText('');
        setCopyStatus('copied');
        window.setTimeout(() => setCopyStatus('idle'), 1600);
      } catch {
        setManualCopyText(material);
        setCopyStatus('failed');
      }
      setInfoStatus('done');
    } catch (err) {
      setTranscriptError(
        err.name === 'AbortError'
          ? '유튜브 정보수집이 너무 오래 걸려 중단했습니다. 잠시 뒤 다시 시도하세요.'
          : err.message || '유튜브 자료를 가져오지 못했습니다.',
      );
      setInfoStatus('failed');
    } finally {
      window.clearTimeout(tid);
    }
  }

  async function handleYoutubeTranscriptFetch({ force = false } = {}) {
    if (hasCommentCandidates && !force) {
      setAreCandidatesVisible(true);
      setTranscriptError('');
      return;
    }
    if (!youtubeLink || transcriptStatus === 'loading') return;
    setTranscriptStatus('loading');
    setTranscriptError('');
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), YOUTUBE_CONTEXT_TIMEOUT_MS);
    try {
      const payload = await fetchYoutubeContextPayload({ event, mode: 'candidates', signal: ctrl.signal });
      setYoutubeContext(payload);
      persistYoutubeContext(event.id, payload);
      setAreCandidatesVisible(true);
      setTranscriptError('');
      setTranscriptStatus('done');
    } catch (err) {
      setTranscriptError(
        err.name === 'AbortError'
          ? '댓글 후보 생성이 너무 오래 걸려 중단했습니다. 잠시 뒤 다시 시도하세요.'
          : err.message || '유튜브 댓글자료를 가져오지 못했습니다.',
      );
      setTranscriptStatus('failed');
    } finally {
      window.clearTimeout(tid);
    }
  }

  async function handleCopyMaterial() {
    const material = buildYoutubeCommentMaterialText(event, youtubeContext);
    if (!material) return;
    try {
      await copyTextToClipboard(material);
      setManualCopyText('');
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1600);
    } catch {
      setManualCopyText(material);
      setCopyStatus('failed');
    }
  }
  async function handleCopyCandidate(text, index) {
    if (!text) return;
    try {
      await copyTextToClipboard(text);
      setManualCopyText('');
      setCopiedCandidateIndex(index);
      window.setTimeout(() => setCopiedCandidateIndex(-1), 1600);
    } catch {
      setManualCopyText(text);
      setCopiedCandidateIndex(-2);
    }
  }

  if (!hasCrawledBody(event)) {
    return (
      <Card className="v2-evdetail__empty">
        <p className="v2-mid">본문은 원문 사이트에서 직접 확인하세요.</p>
        {originalHref && (
          <a className="v2-btn v2-btn--outline v2-btn--sm" href={originalHref} target="_blank" rel="noopener noreferrer">
            원문 열기 ↗
          </a>
        )}
      </Card>
    );
  }

  return (
    <Stack size="lg" className="v2-evdetail">
      <section className="v2-evdetail__body" onClick={() => setIsBodyOpen((v) => !v)}>
        <div className="v2-eyebrow v2-evdetail__sec-label">
          📄 본문
          <span className="v2-muted v2-evdetail__hint">
            {isBodyOpen ? '접기 ▲' : `펼쳐서 전체 보기 (${lines.length}줄) ▼`}
          </span>
        </div>
        <div className={isBodyOpen ? 'v2-evdetail__body-full' : 'v2-evdetail__body-preview'}>
          {(isBodyOpen ? lines : lines.slice(0, 3)).map((line, i) => (
            <p key={`${i}-${line.slice(0, 16)}`}>{line}</p>
          ))}
        </div>
      </section>

      {canFetchYoutubeTranscript && (
        <section className="v2-evdetail__yt">
          <div className="v2-eyebrow v2-evdetail__sec-label">▶️ 유튜브</div>
          <Inline style={{ flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              onClick={handleYoutubeInfoFetch}
              disabled={infoStatus === 'loading' || transcriptStatus === 'loading'}
            >
              {infoStatus === 'loading' ? '정보수집 중…' : '유튜브 정보수집'}
            </Button>
            <Button
              onClick={() => handleYoutubeTranscriptFetch()}
              disabled={transcriptStatus === 'loading' || infoStatus === 'loading'}
            >
              {transcriptStatus === 'loading'
                ? '댓글 생성 중…'
                : hasCommentCandidates ? '댓글 보기' : '댓글 만들기'}
            </Button>
          </Inline>
          {transcriptError && <p className="v2-evdetail__error">{transcriptError}</p>}
        </section>
      )}

      {youtubeContext && (
        <Card className="v2-evdetail__yt-context">
          <div className="v2-eyebrow" style={{ marginBottom: 6 }}>영상 정보</div>
          <Stack size="sm">
            <FieldRow label="영상 제목" value={youtubeContext.title} />
            <FieldRow label="채널" value={youtubeContext.channelName} />
            {youtubeContext.description && (
              <FieldRow label="설명" value={youtubeContext.description} multiline />
            )}
            {youtubeContext.keywords?.length > 0 && (
              <FieldRow label="키워드" value={youtubeContext.keywords.join(', ')} />
            )}
            {(youtubeContext.url || youtubeLink) && (
              <FieldRow
                label="URL"
                value={
                  <a href={youtubeContext.url || youtubeLink} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--c-brand)' }}>
                    {youtubeContext.url || youtubeLink}
                  </a>
                }
              />
            )}
          </Stack>
          <Divider />
          <Button size="sm" variant="outline" onClick={handleCopyMaterial}>
            {copyStatus === 'copied' ? '복사됨 ✓' : '전체 자료 복사'}
          </Button>
          {copyStatus === 'failed' && (
            <p className="v2-evdetail__error">복사에 실패했습니다. 아래 텍스트를 직접 복사하세요.</p>
          )}
        </Card>
      )}

      {areCandidatesVisible && hasCommentCandidates && (
        <Card variant="accent" className="v2-evdetail__candidates">
          <Inline style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
            <div>
              <div className="v2-eyebrow" style={{ color: 'var(--c-brand)' }}>💬 추천 댓글</div>
              <div className="v2-muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                복사 전에 내 말투로 한 번만 다듬어 주세요
              </div>
            </div>
            <Button size="sm" variant="ghost"
              onClick={() => handleYoutubeTranscriptFetch({ force: true })}
              disabled={transcriptStatus === 'loading' || infoStatus === 'loading'}
            >
              {transcriptStatus === 'loading' ? '다시 생성 중…' : '↻ 다시'}
            </Button>
          </Inline>
          <Stack size="sm">
            {youtubeContext.commentCandidates.map((c, index) => (
              <Card key={index} className="v2-evdetail__candidate">
                {c.style && <Tag variant="brand">{c.style}</Tag>}
                <p className="v2-evdetail__candidate-text">{c.text}</p>
                <Button size="sm" onClick={() => handleCopyCandidate(c.text, index)}>
                  {copiedCandidateIndex === index ? '복사됨 ✓' : '댓글 복사'}
                </Button>
              </Card>
            ))}
            {copiedCandidateIndex === -2 && (
              <p className="v2-evdetail__error">복사에 실패했습니다. 아래 텍스트를 직접 복사하세요.</p>
            )}
          </Stack>
        </Card>
      )}

      {!areCandidatesVisible && youtubeContext?.commentCandidatesError && (
        <p className="v2-evdetail__error">
          댓글 생성 실패: {youtubeContext.commentCandidatesError}
        </p>
      )}

      {manualCopyText && (
        <textarea
          className="v2-evdetail__manual"
          value={manualCopyText}
          readOnly
          onClick={(e) => e.currentTarget.select()}
        />
      )}

      <Inline className="v2-evdetail__facts" style={{ flexWrap: 'wrap' }}>
        {event.platform && <Tag variant="info">{event.platform}</Tag>}
        {event.prizeText && <Tag>{event.prizeText}</Tag>}
        {event.totalWinnerCount != null && <Tag>{event.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>}
        {originalHref && (
          <a href={originalHref} target="_blank" rel="noopener noreferrer"
             className="v2-btn v2-btn--ghost v2-btn--sm">
            원문 열기 ↗
          </a>
        )}
      </Inline>
    </Stack>
  );
}

function FieldRow({ label, value, multiline }) {
  return (
    <div className={multiline ? 'v2-evdetail__field v2-evdetail__field--multi' : 'v2-evdetail__field'}>
      <span className="v2-evdetail__field-label">{label}</span>
      <span className="v2-evdetail__field-value">{value || '-'}</span>
    </div>
  );
}
