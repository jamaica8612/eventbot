/* ============================================================
   당첨노트 v2 — 응모함 보드 (메인 관리 화면)
   Source: prototype screens-inbox.jsx
   정렬은 AppV2에서 sortInboxEvents로 처리한 ev[]를 받는다(여기선 칩 필터만).
   액션은 어댑터 dispatchUpdate(onUpdate) / actInbox(onAction) 경유.
   ============================================================ */
import { useMemo, useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Badge, Chip, IconBtn, SegToggle, Empty, PlatformBadge } from '../../components/primitives.jsx';
import { announceMeta, won, parseAmount } from '../../lib/domain.js';

const RESULT_META = {
  pending: { label: '결과 미확인', tone: 'muted', icon: 'clock' },
  win: { label: '당첨', tone: 'win', icon: 'trophy' },
  lose: { label: '미당첨', tone: 'lose', icon: 'xCircle' },
};
const RECEIVE_META = {
  none: { label: '미수령', tone: 'urgent' },
  requested: { label: '수령요청', tone: 'warn' },
  done: { label: '수령완료', tone: 'win' },
};

const lbl = { fontSize: 12, fontWeight: 650, color: 'var(--text-2)', display: 'flex', flexDirection: 'column' };
const inputStyle = {
  width: '100%', marginTop: 5, padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', outline: 'none',
};

function SummaryStrip({ events }) {
  const today = events.filter((e) => e.result === 'pending' && announceMeta(e).key === 'today').length;
  const overdue = events.filter((e) => e.result === 'pending' && announceMeta(e).key === 'overdue').length;
  const wins = events.filter((e) => e.result === 'win');
  const unreceived = wins.filter((e) => e.receiveStatus !== 'done').length;
  const needsAnnouncement = today + overdue;

  const Stat = ({ label, value, sub, tone, icon }) => (
    <div style={{
      flex: '1 1 220px',
      minWidth: 190,
      padding: '10px 12px',
      borderRadius: 'var(--r-md)',
      background: tone === 'urgent' ? 'var(--urgent-weak)' : tone === 'warn' ? 'var(--warn-weak)' : 'var(--surface)',
      border: '1px solid ' + (tone === 'urgent' ? 'var(--urgent)' : tone === 'warn' ? 'var(--warn)' : 'var(--border)'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11.5,
          fontWeight: 650,
          color: tone === 'urgent' ? 'var(--urgent-text)' : tone === 'warn' ? 'var(--warn-text)' : 'var(--text-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {icon && <Icon name={icon} size={12} />}{label}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <div className="tnum" style={{
        fontSize: 20,
        fontWeight: 800,
        color: tone === 'urgent' ? 'var(--urgent-text)' : tone === 'warn' ? 'var(--warn-text)' : 'var(--text)',
        flex: 'none',
      }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <Stat
        label="오늘 발표"
        value={needsAnnouncement}
        sub={overdue ? `발표일 지남 ${overdue}건 포함` : '결과 확인 필요'}
        tone={needsAnnouncement > 0 ? 'warn' : 'muted'}
        icon={needsAnnouncement > 0 ? 'alert' : 'clock'}
      />
      <Stat
        label="미수령"
        value={unreceived}
        sub="아직 받은 표시가 없는 당첨 경품"
        tone={unreceived > 0 ? 'urgent' : 'muted'}
        icon={unreceived > 0 ? 'alert' : 'gift'}
      />
    </div>
  );
}

const INBOX_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '결과 미확인' },
  { key: 'today', label: '오늘발표', tone: 'warn' },
  { key: 'win', label: '당첨' },
  { key: 'unrec', label: '미수령', tone: 'urgent' },
  { key: 'lose', label: '미당첨' },
];

function matchInbox(ev, f) {
  if (f === 'all') return true;
  if (f === 'pending') return ev.result === 'pending';
  if (f === 'today') return ev.result === 'pending' && ['today', 'overdue'].includes(announceMeta(ev).key);
  if (f === 'win') return ev.result === 'win';
  if (f === 'unrec') return ev.result === 'win' && ev.receiveStatus !== 'done';
  if (f === 'lose') return ev.result === 'lose';
  return false;
}

function InboxRow({ ev, onUpdate, onAction }) {
  const [edit, setEdit] = useState(false);
  const am = announceMeta(ev);
  const rm = RESULT_META[ev.result];
  const attention = ev.result === 'pending'
    ? (am.key === 'overdue' ? { t: 'urgent', l: '발표일 지남' } : am.key === 'today' ? { t: 'warn', l: '오늘 발표' } : null)
    : (ev.result === 'win' && ev.receiveStatus !== 'done' ? { t: 'urgent', l: '미수령' } : null);

  const setResult = (r) => onUpdate(ev.id, { result: r });

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid ' + (attention ? 'var(--border-strong)' : 'var(--border)'),
      borderLeft: '3px solid ' + (attention ? (attention.t === 'urgent' ? 'var(--urgent)' : 'var(--warn)') : 'transparent'),
      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-1)', overflow: 'hidden',
    }}>
      <div className="inbox-row-grid" style={{ display: 'grid', gap: 12, padding: 14, alignItems: 'center' }}>
        {/* col 1: date + platform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PlatformBadge platform={ev.platform} />
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>응모</div>
            <div className="tnum">{ev.enteredAt ? fullMD(ev.enteredAt) : '-'}</div>
          </div>
        </div>

        {/* col 2: title + attention */}
        <div style={{ minWidth: 0 }}>
          {attention && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
              <Badge tone={attention.t}><Icon name="alert" size={11} />{attention.l}</Badge>
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'keep-all' }}>{ev.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            🎁 {ev.prizeName || ev.prizeSummary}
            {ev.result === 'win' && ev.prizeAmount > 0 && <b className="tnum" style={{ color: 'var(--win-text)', marginLeft: 6 }}>{won(ev.prizeAmount)}</b>}
          </div>
        </div>

        {/* col 3: status badges */}
        <div className="inbox-status" style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <Badge tone={am.tone}>{am.label}</Badge>
          <Badge tone={rm.tone} icon={rm.icon}>{rm.label}</Badge>
          {ev.result === 'win' && <Badge tone={RECEIVE_META[ev.receiveStatus].tone}>{RECEIVE_META[ev.receiveStatus].label}</Badge>}
        </div>

        {/* col 4: actions */}
        <div className="inbox-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <SegToggle value={ev.result} onChange={setResult} options={[
            { v: 'win', label: '당첨', tone: 'win' }, { v: 'lose', label: '미당첨' }, { v: 'pending', label: '미확인' },
          ]} />
          <IconBtn name="ext" size={32} title="원글 링크" onClick={() => window.open(ev.link, '_blank')} />
          <IconBtn name="pencil" size={32} title="수정" active={edit} onClick={() => setEdit((e) => !e)} />
          <IconBtn name="undo" size={32} title="대기로 되돌리기" onClick={() => { if (window.confirm('이 이벤트를 대기 목록으로 되돌릴까요? 응모 기록이 초기화됩니다.')) onAction(ev.id, 'toWaiting'); }} />
        </div>
      </div>

      {/* receive toggle row (win only) */}
      {ev.result === 'win' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>수령</span>
          <SegToggle value={ev.receiveStatus} onChange={(v) => onUpdate(ev.id, { receiveStatus: v })} options={[
            { v: 'none', label: '미수령', tone: 'urgent' }, { v: 'requested', label: '수령요청', tone: 'warn' }, { v: 'done', label: '수령완료', tone: 'win' },
          ]} />
          {ev.receiveStatus === 'done' && <span style={{ fontSize: 11.5, color: 'var(--win-text)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="check" size={12} /> 완료</span>}
        </div>
      )}

      {/* edit panel */}
      {edit && (
        <div style={{ padding: 14, borderTop: '1px dashed var(--border)', background: 'var(--surface-2)', animation: 'fadeUp .2s var(--ease-out)' }}>
          <div className="edit-grid" style={{ display: 'grid', gap: 11 }}>
            <label style={lbl}>발표일
              <input type="date" defaultValue={ev.announceDate ? ev.announceDate.slice(0, 10) : ''}
                onChange={(e) => onUpdate(ev.id, { announceDate: e.target.value ? new Date(e.target.value + 'T18:00:00+09:00').toISOString() : null })} style={inputStyle} />
            </label>
            <label style={lbl}>메모
              <input type="text" defaultValue={ev.memo || ''} placeholder="예: 커뮤니티 탭에서 발표"
                onChange={(e) => onUpdate(ev.id, { memo: e.target.value })} style={inputStyle} />
            </label>
          </div>
          {ev.result === 'win' && (
            <div className="edit-grid" style={{ display: 'grid', gap: 11, marginTop: 11 }}>
              <label style={lbl}>상품명
                <input type="text" defaultValue={ev.prizeName || ''} placeholder="예: 스타벅스 기프티콘"
                  onChange={(e) => onUpdate(ev.id, { prizeName: e.target.value })} style={inputStyle} />
              </label>
              <label style={lbl}>당첨 금액 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(자연어 입력 OK)</span>
                <input type="text" defaultValue={ev.prizeAmount ? wonShort(ev.prizeAmount).replace('원', '') : ''} placeholder="예: 1만 5000"
                  onBlur={(e) => onUpdate(ev.id, { prizeAmount: parseAmount(e.target.value) })} style={inputStyle} />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// "MM.DD" (응모일 표시)
function fullMD(iso) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getMonth() + 1)}.${p(x.getDate())}`;
}

export function InboxScreen({ events, onUpdate, onAction }) {
  const [filter, setFilter] = useState('all');
  const counts = useMemo(() => {
    const c = {};
    INBOX_FILTERS.forEach((f) => { c[f.key] = events.filter((e) => matchInbox(e, f.key)).length; });
    return c;
  }, [events]);
  const list = events.filter((e) => matchInbox(e, filter));

  return (
    <div>
      <SummaryStrip events={events} />
      <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {INBOX_FILTERS.map((f) => <Chip key={f.key} active={filter === f.key} tone={f.tone} count={counts[f.key]} onClick={() => setFilter(f.key)}>{f.label}</Chip>)}
      </div>
      {list.length === 0
        ? <Empty icon="inbox" title="해당하는 응모가 없어요" sub="필터를 바꿔보세요." />
        : <div style={{ display: 'grid', gap: 10 }}>
            {list.map((ev) => <InboxRow key={ev.id} ev={ev} onUpdate={onUpdate} onAction={onAction} />)}
          </div>}
    </div>
  );
}
