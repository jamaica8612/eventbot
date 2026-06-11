import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { Badge } from '../../components/Badge.jsx';
import { PlatformBadge } from '../../components/PlatformBadge.jsx';
import { Button } from '../../components/Button.jsx';
import { deadlineMeta } from '../../lib/domain.js';

const inputStyle = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
};

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: 99,
      border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)',
      display: 'inline-block', animation: 'spin .7s linear infinite',
    }} />
  );
}

function YoutubeAI({ event, onWinningMetaChange }) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const comment = event.generatedComment;

  const generate = () => {
    setGenerating(true);
    // 실제 생성 로직은 기존 구현 유지; 여기서는 UI만 제공
    setTimeout(() => setGenerating(false), 1300);
  };

  const copy = () => {
    if (!comment) return;
    navigator.clipboard?.writeText(comment).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div style={{ marginTop: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--yt-weak)', color: 'var(--yt)', fontWeight: 700, fontSize: 12.5 }}>
        <Icon name="play" size={14} fill="currentColor" stroke={0} style={{ flex: 'none' }} />
        <span style={{ whiteSpace: 'nowrap' }}>YouTube 응모 도우미</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>AI 댓글 · 시연</span>
      </div>
      <div style={{ padding: 13 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!comment
            ? <Button size="sm" variant="primary" icon={generating ? undefined : 'wand'} onClick={generate} disabled={generating}>
                {generating ? <Spinner /> : '댓글 만들기'}
              </Button>
            : <Button size="sm" variant="outline" icon="refresh" onClick={generate} disabled={generating}>
                {generating ? <Spinner /> : '다시 만들기'}
              </Button>}
        </div>
        {comment && (
          <div style={{ marginTop: 11, padding: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-weak)', background: 'var(--accent-weak)', animation: 'fadeUp .3s var(--ease-out)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <Icon name="sparkles" size={14} style={{ color: 'var(--accent-text)' }} />
              <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>생성된 응모 댓글</span>
              <button
                onClick={copy}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 650, color: 'var(--accent-text)', background: 'var(--surface)', border: '1px solid var(--accent-weak)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={13} />
                <span style={{ whiteSpace: 'nowrap' }}>{copied ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>{comment}</div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="alert" size={12} /> 복사 전에 내 말투로 한번 다듬어 주세요.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function highlight(text, query) {
  if (!query) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return text.split(re).map((p, i) =>
    re.test(p)
      ? <mark key={i} style={{ background: 'var(--warn-weak)', color: 'var(--warn-text)', borderRadius: 3, padding: '0 2px' }}>{p}</mark>
      : p
  );
}

export function EventCard({ event, filter, onStatusChange, onDeadlineChange, onResultChange, onAnnouncementChange, query }) {
  const [expanded, setExpanded] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);

  const dl = deadlineMeta(event.deadlineDate);
  const isYoutube = /youtube|유튜브/i.test(event.platform || '');
  const isSkipped = event.status === 'skipped';
  const isDraft = event.status === 'later';

  const winnerCount = event.totalWinnerCount
    ? Number(event.totalWinnerCount).toLocaleString()
    : null;

  return (
    <article style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: 16,
      boxShadow: 'var(--shadow-1)',
      opacity: isSkipped ? .62 : 1,
      transition: 'box-shadow .2s var(--ease)',
    }}>
      {/* header */}
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <PlatformBadge platform={event.platform} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Badge tone={dl.tone}>
              {dl.key === 'today' && <Icon name="flame" size={11} fill="currentColor" stroke={0} />}
              {dl.label}
            </Badge>
            {winnerCount && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trophy" size={12} /> 당첨 <b className="tnum" style={{ color: 'var(--text-2)' }}>{winnerCount}</b>명
              </span>
            )}
            {event.bookmarkCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="bookmark" size={11} /> <span className="tnum">{event.bookmarkCount}</span>
              </span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.4, color: 'var(--text)', wordBreak: 'keep-all' }}>
            {query ? highlight(event.title || '', query) : (event.title || '')}
          </h3>
          {event.prizeTitle && (
            <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--text-2)' }}>🎁 {event.prizeTitle}</div>
          )}
        </div>
        <button
          onClick={() => setEditingDeadline(e => !e)}
          title="마감 수정"
          style={{
            flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: editingDeadline ? 'var(--accent-text)' : 'var(--text-3)',
            background: editingDeadline ? 'var(--accent-weak)' : 'transparent',
            border: 'none', borderRadius: 7, padding: '5px 8px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon name="pencil" size={13} /> 마감
        </button>
      </div>

      {/* deadline edit panel */}
      {editingDeadline && (
        <div style={{ marginTop: 12, padding: 13, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', gap: 10, animation: 'fadeUp .2s var(--ease-out)' }}>
          <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
            마감일
            <input
              type="date"
              defaultValue={event.deadlineDate ? event.deadlineDate.slice(0, 10) : ''}
              onChange={e => onDeadlineChange && onDeadlineChange(event.id, {
                deadlineDate: e.target.value ? new Date(e.target.value + 'T23:59:00+09:00').toISOString() : '',
                deadlineText: e.target.value || '',
              })}
              style={inputStyle}
            />
          </label>
        </div>
      )}

      {/* body */}
      <div style={{ marginTop: 12 }}>
        {event.description ? (
          <>
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)',
              whiteSpace: 'pre-line',
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? 'none' : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {query ? highlight(event.description, query) : event.description}
            </p>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 650, color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {expanded ? '접기' : '본문 펼치기'}
              <Icon name="chevDown" size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {expanded && event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12, fontSize: 12.5, fontWeight: 650, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                원문 링크 <Icon name="ext" size={12} />
              </a>
            )}
            {expanded && isYoutube && <YoutubeAI event={event} onWinningMetaChange={onAnnouncementChange} />}
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--warn-weak)', display: 'flex', gap: 9, alignItems: 'center' }}>
            <Icon name="alert" size={16} style={{ color: 'var(--warn-text)', flex: 'none' }} />
            <div style={{ fontSize: 12.5, color: 'var(--warn-text)', flex: 1 }}>본문 수집이 차단된 이벤트예요. 원문에서 직접 확인해 주세요.</div>
            {event.url && <Button size="sm" variant="outline" icon="ext" onClick={() => window.open(event.url, '_blank')}>원문</Button>}
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {event.url && (
          <Button variant="primary" icon="ext" onClick={() => window.open(event.url, '_blank')}>참여하기</Button>
        )}
        <Button variant="win" icon="check" onClick={() => onStatusChange && onStatusChange(event.id, 'done')}>참여완료</Button>
        {isDraft
          ? <Button variant="soft" icon="undo" onClick={() => onStatusChange && onStatusChange(event.id, 'ready')}>대기로</Button>
          : event.status !== 'skipped' && (
              <Button variant="soft" icon="bookmark" onClick={() => onStatusChange && onStatusChange(event.id, 'later')}>임시저장</Button>
            )}
        {isSkipped
          ? <Button variant="ghost" icon="undo" onClick={() => onStatusChange && onStatusChange(event.id, 'ready')}>복구</Button>
          : <Button variant="ghost" icon="x" onClick={() => onStatusChange && onStatusChange(event.id, 'skipped')} style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>제외</Button>}
      </div>
    </article>
  );
}
