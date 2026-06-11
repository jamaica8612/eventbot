import { useState } from 'react';
import { deadlineMeta } from '../../lib/domain.js';
import { Icon, Badge, Button, IconBtn, PlatformBadge } from '../../components/index.jsx';

const INPUT_STYLE = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
};

function Spinner({ light }) {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: 99, flexShrink: 0,
      border: '2px solid ' + (light ? 'rgba(255,255,255,.4)' : 'var(--border-strong)'),
      borderTopColor: light ? '#fff' : 'var(--accent)',
      display: 'inline-block', animation: 'spin .7s linear infinite',
    }} />
  );
}

function YoutubeAI({ event, onUpdate }) {
  const yt = event.raw?.youtube || {};
  const [collecting, setCollecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 1400);
  };

  const collect = () => {
    setCollecting(true);
    setTimeout(() => {
      onUpdate(event.id, { raw: { ...event.raw, youtube: { ...yt, infoCollected: true } } });
      setCollecting(false);
      copy(`[유튜브 자료]\n제목: ${event.title}\n채널: ${yt.channel}\n조회수: ${yt.views}\n키워드: ${(yt.keywords || []).join(', ')}`, 'collect');
    }, 1100);
  };

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      const lines = ['영상 너무 잘 봤어요! 👍'];
      if (yt.channel) lines.push(`${yt.channel}님 영상은 늘 군더더기 없이 깔끔해서 좋아요.`);
      lines.push('구독·좋아요 누르고 갑니다 :)');
      lines.push('좋은 이벤트 열어주셔서 감사합니다. 당첨되면 정말 행복할 것 같아요!');
      onUpdate(event.id, { raw: { ...event.raw, youtube: { ...yt, comment: lines.join(' ') } } });
      setGenerating(false);
    }, 1300);
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
          <Button size="sm" variant={yt.infoCollected ? 'soft' : 'outline'} icon={collecting ? undefined : (yt.infoCollected ? 'check' : 'cloud')} onClick={collect} disabled={collecting}>
            {collecting ? <Spinner /> : (yt.infoCollected ? '자료 재수집' : '유튜브 정보수집')}
          </Button>
          {!yt.comment
            ? <Button size="sm" variant="primary" icon={generating ? undefined : 'wand'} onClick={generate} disabled={generating}>{generating ? <Spinner light /> : '댓글 만들기'}</Button>
            : <Button size="sm" variant="outline" icon="refresh" onClick={generate} disabled={generating}>{generating ? <Spinner /> : '다시 만들기'}</Button>
          }
        </div>
        {yt.infoCollected && (
          <div style={{ marginTop: 11, padding: 11, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--text-2)' }}>
              {yt.channel && <span><b style={{ color: 'var(--text)' }}>채널</b> {yt.channel}</span>}
              {yt.views && <span><b style={{ color: 'var(--text)' }}>조회</b> {yt.views}</span>}
            </div>
            {(yt.keywords || []).length > 0 && (
              <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {yt.keywords.map(k => (
                  <span key={k} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--surface-3)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    #{k}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {yt.comment && (
          <div style={{ marginTop: 11, padding: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-weak-2)', background: 'var(--accent-weak)', animation: 'fadeUp .3s var(--ease-out)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <Icon name="sparkles" size={14} style={{ color: 'var(--accent-text)' }} />
              <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>생성된 응모 댓글</span>
              <button onClick={() => copy(yt.comment, 'comment')} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 650, color: 'var(--accent-text)', background: 'var(--surface)', border: '1px solid var(--accent-weak-2)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>
                <Icon name={copied === 'comment' ? 'check' : 'copy'} size={13} />
                <span style={{ whiteSpace: 'nowrap' }}>{copied === 'comment' ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>{yt.comment}</div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="alert" size={12} /> 복사 전에 내 말투로 한번 다듬어 주세요.
            </div>
          </div>
        )}
        {copied === 'collect' && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--win-text)' }}>전체 자료를 클립보드에 복사했어요.</div>}
      </div>
    </div>
  );
}

function highlight(text, query) {
  if (!query || !text) return text;
  const terms = String(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return String(text).split(re).map((p, i) =>
    re.test(p)
      ? <mark key={i} style={{ background: 'var(--warn-weak)', color: 'var(--warn-text)', borderRadius: 3, padding: '0 2px' }}>{p}</mark>
      : p
  );
}

function getBody(event) {
  if (Array.isArray(event.originalLines) && event.originalLines.length > 0) {
    return event.originalLines.join('\n');
  }
  if (typeof event.originalText === 'string' && event.originalText.trim()) {
    return event.originalText.trim();
  }
  return null;
}

export function EventCard({ event, onAction, onUpdate, query }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const dl = deadlineMeta(event.deadlineDate);
  const body = getBody(event);
  const isYoutube = /youtube|유튜브/i.test(event.platform || '');
  const prizeSummary = event.prizeText || event.prizeTitle || '경품 정보 미수집';

  return (
    <article style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      padding: 16, boxShadow: 'var(--shadow-1)',
      opacity: event.status === 'skipped' ? 0.62 : 1,
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
            {event.totalWinnerCount && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trophy" size={12} /> {event.totalWinnerCount}
              </span>
            )}
            {event.bookmarkCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="bookmark" size={11} /> <span className="tnum">{event.bookmarkCount}</span>
              </span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.4, color: 'var(--text)', wordBreak: 'keep-all' }}>
            {highlight(event.title, query)}
          </h3>
          <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--text-2)' }}>🎁 {prizeSummary}</div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          title="마감 수정"
          style={{
            flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: editing ? 'var(--accent-text)' : 'var(--text-3)',
            background: editing ? 'var(--accent-weak)' : 'transparent',
            border: 'none', borderRadius: 7, padding: '5px 8px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon name="pencil" size={13} /> 마감
        </button>
      </div>

      {/* deadline edit panel */}
      {editing && (
        <div style={{ marginTop: 12, padding: 13, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', gap: 10, animation: 'fadeUp .2s var(--ease-out)' }}>
          <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>마감일
            <input
              type="date"
              defaultValue={event.deadlineDate ? event.deadlineDate.slice(0, 10) : ''}
              onChange={e => onUpdate(event.id, {
                deadlineDate: e.target.value ? new Date(e.target.value + 'T23:59:00+09:00').toISOString() : null,
                deadlineText: e.target.value || '',
              })}
              style={INPUT_STYLE}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>메모
            <input
              type="text"
              placeholder="예: 사전등록 폼 필요"
              defaultValue={event.deadlineText || ''}
              onChange={e => onUpdate(event.id, { deadlineText: e.target.value })}
              style={INPUT_STYLE}
            />
          </label>
        </div>
      )}

      {/* body */}
      <div style={{ marginTop: 12 }}>
        {!body ? (
          <div style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--warn-weak)', display: 'flex', gap: 9, alignItems: 'center' }}>
            <Icon name="alert" size={16} style={{ color: 'var(--warn-text)', flex: 'none' }} />
            <div style={{ fontSize: 12.5, color: 'var(--warn-text)', flex: 1 }}>
              본문 수집이 차단된 이벤트예요. 원문에서 직접 확인해 주세요.
            </div>
            <Button size="sm" variant="outline" icon="ext" onClick={() => window.open(event.url, '_blank')}>
              원문
            </Button>
          </div>
        ) : (
          <>
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-line',
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 3,
              WebkitBoxOrient: 'vertical',
              overflow: expanded ? 'visible' : 'hidden',
            }}>
              {highlight(body, query)}
            </p>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 650, color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {expanded ? '접기' : '본문 펼치기'}
              <Icon name="chevDown" size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {expanded && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12, fontSize: 12.5, fontWeight: 650, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                원문 링크 <Icon name="ext" size={12} />
              </a>
            )}
            {expanded && isYoutube && <YoutubeAI event={event} onUpdate={onUpdate} />}
          </>
        )}
      </div>

      {/* actions */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" icon="ext" onClick={() => window.open(event.url, '_blank')}>참여하기</Button>
        <Button variant="win" icon="check" onClick={() => onAction(event.id, 'enter')}>참여완료</Button>
        {event.status === 'later'
          ? <Button variant="soft" icon="undo" onClick={() => onAction(event.id, 'toWaiting')}>대기로</Button>
          : event.status !== 'skipped' && (
            <Button variant="soft" icon="bookmark" onClick={() => onAction(event.id, 'draft')}>임시저장</Button>
          )
        }
        {event.status === 'skipped'
          ? <Button variant="ghost" icon="undo" onClick={() => onAction(event.id, 'toWaiting')}>복구</Button>
          : (
            <Button
              variant="ghost" icon="x"
              onClick={() => onAction(event.id, 'exclude')}
              style={{ marginLeft: 'auto', color: 'var(--text-3)' }}
            >
              제외
            </Button>
          )
        }
      </div>
    </article>
  );
}
