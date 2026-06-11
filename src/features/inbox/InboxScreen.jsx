import { useState, useMemo } from 'react';
import { announceMeta, inboxSortKey, won, wonShort, parseAmount } from '../../lib/domain.js';
import { Icon, Badge, Seg, IconBtn, Empty, PlatformBadge, Chip } from '../../components/index.jsx';
import { formatDate } from '../../utils/format.js';

const INPUT_STYLE = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
};

const RESULT_META = {
  unknown: { label: '결과 미확인', tone: 'muted',   icon: 'clock' },
  won:     { label: '당첨',        tone: 'win',     icon: 'trophy' },
  lost:    { label: '미당첨',      tone: 'lose',    icon: 'xCircle' },
};

const RECEIVE_META = {
  unclaimed: { label: '미수령',   tone: 'urgent' },
  requested: { label: '수령요청', tone: 'warn' },
  received:  { label: '수령완료', tone: 'win' },
};

const INBOX_FILTERS = [
  { key: 'all',     label: '전체' },
  { key: 'pending', label: '결과 미확인' },
  { key: 'today',   label: '오늘발표', tone: 'warn' },
  { key: 'win',     label: '당첨' },
  { key: 'unrec',   label: '미수령', tone: 'urgent' },
  { key: 'lose',    label: '미당첨' },
];

function matchInbox(event, f) {
  if (f === 'all') return true;
  if (f === 'pending') return event.resultStatus === 'unknown';
  if (f === 'today') {
    return event.resultStatus === 'unknown' &&
      ['passed', 'today'].includes(announceMeta(event.resultAnnouncementDate).key);
  }
  if (f === 'win')   return event.resultStatus === 'won';
  if (f === 'unrec') return event.resultStatus === 'won' && event.receiptStatus !== 'received';
  if (f === 'lose')  return event.resultStatus === 'lost';
  return false;
}

function cmpSortKey(a, b) {
  const ka = inboxSortKey(a);
  const kb = inboxSortKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function SummaryStrip({ events }) {
  const total      = events.length;
  const todayCount = events.filter(e => e.resultStatus === 'unknown' && ['passed','today'].includes(announceMeta(e.resultAnnouncementDate).key)).length;
  const wins       = events.filter(e => e.resultStatus === 'won');
  const unreceived = wins.filter(e => e.receiptStatus !== 'received').length;
  const decided    = events.filter(e => e.resultStatus !== 'unknown').length;
  const rate       = decided ? Math.round(wins.length / decided * 1000) / 10 : 0;
  const prize      = wins.reduce((s, e) => s + (Number(e.prizeAmount) || 0), 0);

  const Stat = ({ label, value, sub, attention }) => (
    <div style={{
      flex: '1 1 120px', minWidth: 110, padding: '13px 15px', borderRadius: 'var(--r-md)',
      background: attention ? 'var(--warn-weak)' : 'var(--surface)',
      border: '1px solid ' + (attention ? 'var(--warn)' : 'var(--border)'),
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 650, color: attention ? 'var(--warn-text)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {attention && <Icon name="alert" size={12} />}{label}
      </div>
      <div className="tnum" style={{ fontSize: 23, fontWeight: 800, marginTop: 3, color: attention ? 'var(--warn-text)' : 'var(--text)', letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <Stat label="응모완료" value={total} sub="건" />
      <Stat label="오늘 발표" value={todayCount} sub="확인 필요" attention={todayCount > 0} />
      <Stat label="미수령" value={unreceived} sub="당첨 경품" attention={unreceived > 0} />
      <Stat label="당첨률" value={rate + '%'} sub={`${wins.length}/${decided} 결과확정`} />
      <Stat label="당첨금 합계" value={wonShort(prize).replace('원', '')} sub="원" />
    </div>
  );
}

function InboxRow({ event, onUpdate, onAction }) {
  const [edit, setEdit] = useState(false);
  const am  = announceMeta(event.resultAnnouncementDate);
  const rm  = RESULT_META[event.resultStatus] || RESULT_META.unknown;
  const rcm = RECEIVE_META[event.receiptStatus] || RECEIVE_META.unclaimed;

  const attention =
    event.resultStatus === 'unknown'
      ? (am.key === 'passed' ? { t: 'urgent', l: '발표일 지남' }
        : am.key === 'today' ? { t: 'warn', l: '오늘 발표' }
        : null)
      : (event.resultStatus === 'won' && event.receiptStatus !== 'received'
        ? { t: 'urgent', l: '미수령' }
        : null);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid ' + (attention ? 'var(--border-strong)' : 'var(--border)'),
      borderLeft: '3px solid ' + (attention
        ? (attention.t === 'urgent' ? 'var(--urgent)' : 'var(--warn)')
        : 'transparent'),
      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-1)', overflow: 'hidden',
    }}>
      <div className="inbox-row-grid" style={{ display: 'grid', gap: 12, padding: 14, alignItems: 'center' }}>
        {/* 날짜 + 플랫폼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PlatformBadge platform={event.platform} />
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>응모</div>
            <div className="tnum">{formatDate(event.participatedAt)}</div>
          </div>
        </div>

        {/* 제목 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
            {attention && <Badge tone={attention.t}><Icon name="alert" size={11} />{attention.l}</Badge>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'keep-all' }}>
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            🎁 {event.prizeTitle || event.prizeText || '경품 미수집'}
            {event.resultStatus === 'won' && Number(event.prizeAmount) > 0 && (
              <b className="tnum" style={{ color: 'var(--win-text)', marginLeft: 6 }}>
                {won(Number(event.prizeAmount))}
              </b>
            )}
          </div>
        </div>

        {/* 상태 뱃지 */}
        <div className="inbox-status" style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <Badge tone={am.tone}>{am.label}</Badge>
          <Badge tone={rm.tone} icon={rm.icon}>{rm.label}</Badge>
          {event.resultStatus === 'won' && (
            <Badge tone={rcm.tone}>{rcm.label}</Badge>
          )}
        </div>

        {/* 액션 */}
        <div className="inbox-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Seg
            value={event.resultStatus}
            onChange={(v) => onUpdate(event.id, { resultStatus: v })}
            options={[
              { v: 'won',     label: '당첨',  tone: 'win' },
              { v: 'lost',    label: '미당첨' },
              { v: 'unknown', label: '미확인' },
            ]}
          />
          <IconBtn name="ext"    size={32} title="원글 링크" onClick={() => window.open(event.url, '_blank')} />
          <IconBtn name="pencil" size={32} title="수정" active={edit} onClick={() => setEdit(e => !e)} />
          <IconBtn
            name="undo" size={32} title="대기로 되돌리기"
            onClick={() => {
              if (window.confirm('이 이벤트를 대기 목록으로 되돌릴까요? 응모 기록이 초기화됩니다.')) {
                onAction(event.id, 'toWaiting');
              }
            }}
          />
        </div>
      </div>

      {/* 수령 토글 (당첨 시) */}
      {event.resultStatus === 'won' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>수령</span>
          <Seg
            value={event.receiptStatus || 'unclaimed'}
            onChange={(v) => onUpdate(event.id, { receiptStatus: v })}
            options={[
              { v: 'unclaimed', label: '미수령',   tone: 'urgent' },
              { v: 'requested', label: '수령요청', tone: 'warn' },
              { v: 'received',  label: '수령완료', tone: 'win' },
            ]}
          />
          {event.receiptStatus === 'received' && (
            <span style={{ fontSize: 11.5, color: 'var(--win-text)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon name="check" size={12} /> 완료
            </span>
          )}
        </div>
      )}

      {/* 편집 패널 */}
      {edit && (
        <div style={{ padding: 14, borderTop: '1px dashed var(--border)', background: 'var(--surface-2)', animation: 'fadeUp .2s var(--ease-out)' }}>
          <div className="edit-grid" style={{ display: 'grid', gap: 11 }}>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>발표일
              <input
                type="date"
                defaultValue={event.resultAnnouncementDate ? event.resultAnnouncementDate.slice(0, 10) : ''}
                onChange={e => onUpdate(event.id, {
                  resultAnnouncementDate: e.target.value ? new Date(e.target.value + 'T18:00:00+09:00').toISOString() : null,
                })}
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>메모
              <input
                type="text"
                defaultValue={event.winningMemo || ''}
                placeholder="예: 커뮤니티 탭에서 발표"
                onChange={e => onUpdate(event.id, { winningMemo: e.target.value })}
                style={INPUT_STYLE}
              />
            </label>
          </div>
          {event.resultStatus === 'won' && (
            <div className="edit-grid" style={{ display: 'grid', gap: 11, marginTop: 11 }}>
              <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>상품명
                <input
                  type="text"
                  defaultValue={event.prizeTitle || ''}
                  placeholder="예: 스타벅스 기프티콘"
                  onChange={e => onUpdate(event.id, { prizeTitle: e.target.value })}
                  style={INPUT_STYLE}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
                당첨 금액 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(자연어 입력 OK)</span>
                <input
                  type="text"
                  defaultValue={event.prizeAmount ? wonShort(Number(event.prizeAmount)).replace('원', '') : ''}
                  placeholder="예: 1만 5000"
                  onBlur={e => onUpdate(event.id, { prizeAmount: parseAmount(e.target.value) })}
                  style={INPUT_STYLE}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InboxScreen({ events, onUpdate, onAction }) {
  const [filter, setFilter] = useState('all');

  const sorted = useMemo(() => [...events].sort(cmpSortKey), [events]);

  const counts = useMemo(() => {
    const c = {};
    INBOX_FILTERS.forEach(f => { c[f.key] = events.filter(e => matchInbox(e, f.key)).length; });
    return c;
  }, [events]);

  const list = sorted.filter(e => matchInbox(e, filter));

  return (
    <div>
      <SummaryStrip events={events} />
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {INBOX_FILTERS.map(f => (
          <Chip
            key={f.key}
            active={filter === f.key}
            tone={f.tone}
            count={counts[f.key]}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      {list.length === 0
        ? <Empty icon="inbox" title="해당하는 응모가 없어요" sub="필터를 바꿔보세요." />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map(ev => (
              <InboxRow key={ev.id} event={ev} onUpdate={onUpdate} onAction={onAction} />
            ))}
          </div>
        )
      }
    </div>
  );
}
