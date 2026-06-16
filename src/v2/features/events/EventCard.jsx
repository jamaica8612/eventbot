/* ============================================================
   당첨노트 v2 — 이벤트 카드 (대기/마감/임시저장/검색 공통)
   Source: prototype screens-events.jsx EventCard
   onAction=actList, onUpdate=dispatchUpdate(어댑터). 참여하기는 applyUrl 우선.
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Badge, Btn, PlatformBadge } from '../../components/primitives.jsx';
import { deadlineMeta } from '../../lib/domain.js';
import { buildYoutubeLinks } from '../../lib/youtube.js';
import { YoutubeAI, hasYoutubeHelper } from './YoutubeAI.jsx';

const inputStyle = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', background: 'var(--surface)',
  color: 'var(--text)', outline: 'none',
};

export function EventCard({ ev, onAction, onUpdate, query }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const dl = deadlineMeta(ev);

  const hi = (text) => {
    if (!query) return text;
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return text;
    const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return String(text).split(re).map((p, i) => (re.test(p)
      ? <mark key={i} style={{ background: 'var(--warn-weak)', color: 'var(--warn-text)', borderRadius: 3, padding: '0 2px' }}>{p}</mark>
      : p));
  };

  // 유튜브 이벤트의 영상 URL은 raw.externalLinks에만 있고 applyUrl/link는 슈퍼투데이 출처일 수 있어,
  // youtube면 실제 영상 링크를 우선 연다.
  const openApply = () => {
    const ytLink = ev.platform === 'youtube' && ev._event ? buildYoutubeLinks(ev._event)[0] : '';
    window.open(ytLink || ev.applyUrl || ev.link, '_blank', 'noopener');
  };

  return (
    <article style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      padding: 16, boxShadow: 'var(--shadow-1)', opacity: ev.status === 'excluded' ? 0.62 : 1,
      transition: 'box-shadow .2s var(--ease)',
    }}>
      {/* header */}
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <PlatformBadge platform={ev.platform} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Badge tone={dl.tone}>{dl.key === 'today' && <Icon name="flame" size={11} fill="currentColor" stroke={0} />}{dl.label}</Badge>
            {ev.winners > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trophy" size={12} /> 당첨 <b className="tnum" style={{ color: 'var(--text-2)' }}>{ev.winners.toLocaleString()}</b>명
              </span>
            )}
            {ev.savedCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="bookmark" size={11} /> <span className="tnum">{ev.savedCount}</span>
              </span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.4, color: 'var(--text)', wordBreak: 'keep-all' }}>{hi(ev.title)}</h3>
          <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--text-2)' }}>🎁 {ev.prizeSummary}</div>
        </div>
        <button onClick={() => setEditing((e) => !e)} title="마감 수정" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: editing ? 'var(--accent-text)' : 'var(--text-3)', background: editing ? 'var(--accent-weak)' : 'transparent', border: 'none', borderRadius: 7, padding: '5px 8px', fontWeight: 600, cursor: 'pointer' }}>
          <Icon name="pencil" size={13} /> 마감
        </button>
      </div>

      {/* edit deadline panel */}
      {editing && (
        <div style={{ marginTop: 12, padding: 13, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', gap: 10, animation: 'fadeUp .2s var(--ease-out)' }}>
          <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>마감일
            <input type="date" defaultValue={ev.deadline ? ev.deadline.slice(0, 10) : ''}
              onChange={(e) => onUpdate(ev.id, { deadline: e.target.value ? new Date(e.target.value + 'T23:59:00+09:00').toISOString() : null, deadlineText: '' })} style={inputStyle} />
          </label>
        </div>
      )}

      {/* body */}
      <div style={{ marginTop: 12 }}>
        {ev.bodyBlocked ? (
          <div style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--warn-weak)', display: 'flex', gap: 9, alignItems: 'center' }}>
            <Icon name="alert" size={16} style={{ color: 'var(--warn-text)', flex: 'none' }} />
            <div style={{ fontSize: 12.5, color: 'var(--warn-text)', flex: 1 }}>본문 수집이 차단된 이벤트예요. 원문에서 직접 확인해 주세요.</div>
            <Btn size="sm" variant="outline" icon="ext" onClick={openApply}>원문</Btn>
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-line',
              display: expanded ? 'block' : '-webkit-box', WebkitLineClamp: expanded ? 'none' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{hi(ev.body)}</p>
            <button onClick={() => setExpanded((e) => !e)} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 650, color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              {expanded ? '접기' : '본문 펼치기'} <Icon name="chevDown" size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {expanded && (
              <a href={ev.link} target="_blank" rel="noreferrer" style={{ marginLeft: 12, fontSize: 12.5, fontWeight: 650, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                원문 링크 <Icon name="ext" size={12} />
              </a>
            )}
            {expanded && hasYoutubeHelper(ev) && <YoutubeAI ev={ev} />}
          </>
        )}
      </div>

      {/* actions */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="primary" icon="ext" onClick={openApply}>참여하기</Btn>
        <Btn variant="win" icon="check" onClick={() => onAction(ev.id, 'enter')}>참여완료</Btn>
        {ev.status === 'draft'
          ? <Btn variant="soft" icon="undo" onClick={() => onAction(ev.id, 'toWaiting')}>대기로</Btn>
          : ev.status !== 'excluded' && <Btn variant="soft" icon="bookmark" onClick={() => onAction(ev.id, 'draft')}>임시저장</Btn>}
        {ev.status === 'excluded'
          ? <Btn variant="ghost" icon="undo" onClick={() => onAction(ev.id, 'toWaiting')}>복구</Btn>
          : <Btn variant="ghost" icon="x" onClick={() => onAction(ev.id, 'exclude')} style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>제외</Btn>}
      </div>
    </article>
  );
}
