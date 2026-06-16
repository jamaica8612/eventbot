/* ============================================================
   당첨노트 v2 — YouTube 응모 도우미 (실제 Gemini 배선)
   프로토타입 YoutubeAI 디자인 + 현재 EventBodyToggle의 실제 fetch(lib/youtube.js).
   ev._event(원본)로 fetch, 결과 youtubeContext를 Supabase에 저장.
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Badge, Btn, Spinner } from '../../components/primitives.jsx';
import {
  YT_CONTEXT_TIMEOUT_MS,
  YT_INFO_TIMEOUT_MS,
  buildYoutubeCommentMaterialText,
  copyTextToClipboard,
  fetchYoutubeContext,
  hasYoutubeLink,
  normalizeSavedYoutubeContext,
  persistYoutubeContext,
} from '../../lib/youtube.js';

export function hasYoutubeHelper(ev) {
  // 직접 영상 링크(raw.externalLinks에 수집된 YouTube URL)가 있을 때만 표시.
  // 크롤러가 응모 링크(link.php)를 따라가 채운다.
  return Boolean(ev && ev._event) && hasYoutubeLink(ev._event);
}

export function YoutubeAI({ ev }) {
  const event = ev._event;
  const [ctx, setCtx] = useState(() => normalizeSavedYoutubeContext(event.youtubeContext));
  const [infoStatus, setInfoStatus] = useState('idle');
  const [genStatus, setGenStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copyKey, setCopyKey] = useState('');
  const [manualCopyText, setManualCopyText] = useState('');
  const [copyStatus, setCopyStatus] = useState('idle');

  const candidates = ctx?.commentCandidates ?? [];
  const hasCandidates = candidates.length > 0;
  const transcriptLines = getTranscriptLines(event, ctx);
  const commentLines = Array.isArray(ctx?.comments) ? ctx.comments.slice(0, 5) : [];
  const youtubeUrl = ctx?.url || (event ? buildYoutubeUrlFromEvent(event) : '');

  async function runFetch(mode, setStatus, timeout) {
    setStatus('loading');
    setError('');
    setCopyStatus('idle');
    setManualCopyText('');
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), timeout);
    try {
      const payload = await fetchYoutubeContext({ event, mode, signal: abort.signal });
      setCtx(payload);
      persistYoutubeContext(event.id, payload);
      if (mode === 'context') {
        await copyMaterial(payload);
      }
      setStatus('done');
      return payload;
    } catch (e) {
      setError(e.name === 'AbortError' ? '시간이 너무 오래 걸려 중단했습니다. 잠시 뒤 다시 시도하세요.' : (e.message || '유튜브 자료를 가져오지 못했습니다.'));
      setStatus('failed');
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function copyMaterial(nextCtx = ctx) {
    const text = buildYoutubeCommentMaterialText(event, nextCtx);
    if (!text) return;
    try {
      await copyTextToClipboard(text);
      setManualCopyText('');
      setCopyStatus('copied');
      setCopyKey('material');
      window.setTimeout(() => {
        setCopyStatus('idle');
        setCopyKey('');
      }, 1600);
    } catch {
      setManualCopyText(text);
      setCopyStatus('failed');
      setCopyKey('');
    }
  }

  async function copy(text, key) {
    if (!text) return;
    try {
      await copyTextToClipboard(text);
      setManualCopyText('');
      setCopyKey(key);
      window.setTimeout(() => setCopyKey(''), 1500);
    } catch {
      setManualCopyText(text);
      setCopyKey('');
    }
  }

  const collecting = infoStatus === 'loading';
  const generating = genStatus === 'loading';

  return (
    <div style={{ marginTop: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--yt-weak)', color: 'var(--yt)', fontWeight: 700, fontSize: 12.5 }}>
        <Icon name="play" size={14} fill="currentColor" stroke={0} style={{ flex: 'none' }} />
        <span style={{ whiteSpace: 'nowrap' }}>YouTube 응모 도우미</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>AI 댓글 후보</span>
      </div>

      <div style={{ padding: 13 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" variant={ctx ? 'soft' : 'outline'} icon={collecting ? undefined : (ctx ? 'check' : 'cloud')}
            onClick={() => runFetch('context', setInfoStatus, YT_INFO_TIMEOUT_MS)} disabled={collecting || generating}>
            {collecting ? <Spinner size={14} /> : (ctx ? '정보 재수집' : '유튜브 정보수집')}
          </Btn>
          <Btn size="sm" variant={hasCandidates ? 'outline' : 'primary'} icon={generating ? undefined : (hasCandidates ? 'refresh' : 'wand')}
            onClick={() => runFetch('candidates', setGenStatus, YT_CONTEXT_TIMEOUT_MS)} disabled={collecting || generating}>
            {generating ? <Spinner size={14} /> : (hasCandidates ? '다시 만들기' : '댓글 만들기')}
          </Btn>
          {ctx && (
            <Btn size="sm" variant="ghost" icon="copy" onClick={() => copyMaterial()}>
              {copyKey === 'material' ? '복사됨' : '전체 자료 복사'}
            </Btn>
          )}
        </div>

        {error ? <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--urgent-text)' }}>{error}</p> : null}
        {copyStatus === 'copied' ? (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--win-text)', fontWeight: 650 }}>수집한 유튜브 자료를 복사했습니다.</p>
        ) : null}

        {/* collected video info */}
        {ctx && (
          <div style={{ marginTop: 11, padding: 11, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', fontSize: 12.5, overflowWrap: 'anywhere', display: 'grid', gap: 9 }}>
            <div style={{ display: 'grid', gap: 5, color: 'var(--text-2)' }}>
              {ctx.title && <span><b style={{ color: 'var(--text)' }}>영상</b> {ctx.title}</span>}
              {ctx.channelName && <span><b style={{ color: 'var(--text)' }}>채널</b> {ctx.channelName}</span>}
              {youtubeUrl && (
                <span>
                  <b style={{ color: 'var(--text)' }}>URL</b>{' '}
                  <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>{youtubeUrl}</a>
                </span>
              )}
              <span>
                <b style={{ color: 'var(--text)' }}>지표</b>{' '}
                조회 {formatNumber(ctx.viewCount)} · 좋아요 {formatNumber(ctx.likeCount)} · 댓글 {formatNumber(ctx.commentCount)}
              </span>
            </div>
            {ctx.keywords?.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ctx.keywords.slice(0, 8).map((k) => <span key={k} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--surface-3)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>#{k}</span>)}
              </div>
            ) : null}
            {ctx.description ? (
              <DetailBlock title="영상 설명" text={ctx.description} />
            ) : null}
            {transcriptLines.length ? (
              <DetailBlock title="스크립트" text={transcriptLines.slice(0, 8).join('\n')} />
            ) : null}
            {commentLines.length ? (
              <DetailBlock
                title="인기 댓글"
                text={commentLines.map((c) => `좋아요 ${c.likes ?? 0}: ${c.text}`).join('\n')}
              />
            ) : null}
          </div>
        )}

        {/* generated comment candidates */}
        {hasCandidates && (
          <div style={{ marginTop: 11, display: 'grid', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
              <Icon name="sparkles" size={13} style={{ color: 'var(--accent-text)' }} />
              <span>복사 전에 내 말투로 한 번만 다듬어 주세요</span>
            </div>
            {candidates.map((c, i) => (
              <div key={i} style={{ padding: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-weak-2)', background: 'var(--accent-weak)', animation: 'fadeUp .3s var(--ease-out)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  {c.style ? <Badge tone="accent">{c.style}</Badge> : <span />}
                  <button onClick={() => copy(c.text, `c${i}`)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 650, color: 'var(--accent-text)', background: 'var(--surface)', border: '1px solid var(--accent-weak-2)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>
                    <Icon name={copyKey === `c${i}` ? 'check' : 'copy'} size={13} />
                    <span style={{ whiteSpace: 'nowrap' }}>{copyKey === `c${i}` ? '복사됨' : '댓글 복사'}</span>
                  </button>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}

        {!hasCandidates && ctx?.commentCandidatesError ? (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--urgent-text)' }}>댓글 생성 실패: {ctx.commentCandidatesError}</p>
        ) : null}

        {manualCopyText ? (
          <div style={{ marginTop: 11, display: 'grid', gap: 7 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--urgent-text)' }}>자동 복사에 실패했습니다. 아래 내용을 직접 선택해서 복사하세요.</p>
            <textarea
              value={manualCopyText}
              readOnly
              onClick={(e) => e.currentTarget.select()}
              style={{
                width: '100%',
                minHeight: 170,
                resize: 'vertical',
                boxSizing: 'border-box',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface)',
                color: 'var(--text)',
                padding: 10,
                fontSize: 12,
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailBlock({ title, text }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <b style={{ color: 'var(--text)', fontSize: 12 }}>{title}</b>
      <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.55, whiteSpace: 'pre-line', maxHeight: 116, overflow: 'auto' }}>
        {text}
      </p>
    </div>
  );
}

function buildYoutubeUrlFromEvent(event) {
  const raw = event.raw ?? {};
  return [
    event.applyTargetUrl,
    raw.applyTargetUrl,
    ...(Array.isArray(event.externalLinks) ? event.externalLinks : []),
    ...(Array.isArray(raw.externalLinks) ? raw.externalLinks : []),
  ].find((url) => /youtube\.com|youtu\.be/i.test(String(url ?? ''))) ?? '';
}

function getTranscriptLines(event, context) {
  if (Array.isArray(context?.transcript?.lines) && context.transcript.lines.length > 0) {
    return context.transcript.lines;
  }
  const transcripts = [
    ...(Array.isArray(event?.youtubeTranscripts) ? event.youtubeTranscripts : []),
    ...(Array.isArray(event?.raw?.youtubeTranscripts) ? event.raw.youtubeTranscripts : []),
  ];
  const crawled = transcripts.find(
    (t) => t?.status === 'ok' && (Array.isArray(t.lines) ? t.lines.length > 0 : t.text),
  );
  if (Array.isArray(crawled?.lines) && crawled.lines.length > 0) return crawled.lines;
  if (crawled?.text) return String(crawled.text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (context?.transcript?.text) return String(context.transcript.text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return [];
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
}
