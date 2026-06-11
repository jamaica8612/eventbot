import { useState, useMemo } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { Badge } from '../../components/Badge.jsx';
import { PlatformBadge } from '../../components/PlatformBadge.jsx';
import { Chip } from '../../components/Chip.jsx';
import { Seg } from '../../components/Seg.jsx';
import { IconBtn } from '../../components/Button.jsx';
import { Empty } from '../../components/Empty.jsx';
import { announceMeta, inboxSortKey, won, wonShort } from '../../lib/domain.js';

const RESULT_META = {
  unknown: { label: '결과 미확인', tone: 'muted', icon: 'clock' },
  won:     { label: '당첨',       tone: 'win',   icon: 'trophy' },
  lost:    { label: '미당첨',     tone: 'lose',  icon: 'xCircle' },
};

const RECEIPT_META = {
  unclaimed:  { label: '미수령',   tone: 'urgent' },
  requested:  { label: '수령요청', tone: 'warn' },
  received:   { label: '수령완료', tone: 'win' },
};

const RESULT_OPTIONS = [
  { v: 'won',     label: '당첨',  tone: 'win' },
  { v: 'lost',    label: '미당첨' },
  { v: 'unknown', label: '미확인' },
];

const RECEIPT_OPTIONS = [
  { v: 'unclaimed',  label: '미수령',   tone: 'urgent' },
  { v: 'requested',  label: '수령요청', tone: 'warn' },
  { v: 'received',   label: '수령완료', tone: 'win' },
];

const INBOX_FILTERS = [
  { key: 'all',     label: '전체' },
  { key: 'pending', label: '결과 미확인' },
  { key: 'today',   label: '오늘발표', tone: 'warn' },
  { key: 'won',     label: '당첨',     tone: 'win' },
  { key: 'unrec',   label: '미수령',   tone: 'urgent' },
  { key: 'lost',    label: '미당첨' },
];

function matchInbox(ev, f) {
  const am = announceMeta(ev.resultAnnouncementDate);
  if (f === 'all') return true;
  if (f === 'pending') return ev.resultStatus === 'unknown';
  if (f === 'today') return ev.resultStatus === 'unknown' && ['today', 'passed'].includes(am.key);
  if (f === 'won') return ev.resultStatus === 'won';
  if (f === 'unrec') return ev.resultStatus === 'won' && ev.receiptStatus !== 'received';
  if (f === 'lost') return ev.resultStatus === 'lost';
  return true;
}

const inputStyle = {
  display: 'block', width: '100%', marginTop: 5, padding: '8px 11px', fontSize: 13,
  border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
};
function SummaryStrip({ events, totalAmount }) {
  const entered = events.length;
  const am_today = events.filter(e => {
    const am = announceMeta(e.resultAnnouncementDate);
    return e.resultStatus === 'unknown' && (am.key === 'today' || am.key === 'passed');
  }).length;
  const wins = events.filter(e => e.resultStatus === 'won');
  const unreceived = wins.filter(e => e.receiptStatus !== 'received').length;
  const decided = events.filter(e => e.resultStatus !== 'unknown').length;
  const rate = decided ? Math.round(wins.length / decided * 1000) / 10 : 0;

  const Stat = ({ label, value, sub, attention }) => (
    <div style={{
      flex: '1 1 110px', minWidth: 100,
      padding: '13px 15px',
      borderRadius: 'var(--r-md)',
      background: attention ? 'var(--warn-weak)' : 'var(--surface)',
      border: '1px solid ' + (attention ? 'var(--warn)' : 'var(--border)'),
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 650, color: attention ? 'var(--warn-text)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {attention && <Icon name="alert" size={12} />}{label}
      </div>
      <div className="tnum" style={{ fontSize: 22, fontWeight: 800, marginTop: 3, color: attention ? 'var(--warn-text)' : 'var(--text)', letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <Stat label="응모완료" value={entered} sub="건" />
      <Stat label="발표확인" value={am_today} sub="오늘·지남 포함" attention={am_today > 0} />
      <Stat label="미수령" value={unreceived} sub="당첨 경품" attention={unreceived > 0} />
      <Stat label="당첨률" value={rate + '%'} sub={`${wins.length}/${decided} 결과확정`} />
      {totalAmount > 0 && <Stat label="당첨금 합계" value={wonShort(totalAmount).replace('원', '')} sub="원" />}
    </div>
  );
}

function InboxRow({ event, onResultChange, onAnnouncementChange, onMetaChange, onDelete }) {
  const [edit, setEdit] = useState(false);
  const am = announceMeta(event.resultAnnouncementDate);
  const rm = RESULT_META[event.resultStatus] || RESULT_META.unknown;

  const attention = event.resultStatus === 'unknown'
    ? (am.key === 'passed' ? { t: 'urgent', l: '발표일 지남' }
      : am.key === 'today' ? { t: 'warn', l: '오늘 발표' } : null)
    : (event.resultStatus === 'won' && event.receiptStatus !== 'received' ? { t: 'urgent', l: '미수령' } : null);

  function handleDelete() {
    if (!window.confirm('이 이벤트를 대기 목록으로 되돌릴까요? 응모 기록이 초기화됩니다.')) return;
    onDelete && onDelete(event.id);
  }

  function handleAnnounceDateBlur(isoDate) {
    onAnnouncementChange && onAnnouncementChange(event.id, {
      resultAnnouncementDate: isoDate,
      resultAnnouncementText: isoDate ? isoDate.slice(0, 10) : '',
    });
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid ' + (attention ? 'var(--border-strong)' : 'var(--border)'),
      borderLeft: '3px solid ' + (attention ? (attention.t === 'urgent' ? 'var(--urgent)' : 'var(--warn)') : 'transparent'),
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-1)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12, padding: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PlatformBadge platform={event.platform} />
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>응모</div>
            {event.participatedAt && (
              <div className="tnum">{event.participatedAt.slice(5, 10)}</div>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
            {attention && <Badge tone={attention.t}><Icon name="alert" size={11} />{attention.l}</Badge>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'keep-all' }}>
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {'\u{1F381}'} {event.prizeTitle || '경품 정보 없음'}
            {event.resultStatus === 'won' && event.prizeAmount > 0 && (
              <b className="tnum" style={{ color: 'var(--win-text)', marginLeft: 6 }}>{won(event.prizeAmount)}</b>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <Badge tone={am.tone}>{am.label}</Badge>
          <Badge tone={rm.tone} icon={rm.icon}>{rm.label}</Badge>
          {event.resultStatus === 'won' && RECEIPT_META[event.receiptStatus] && (
            <Badge tone={RECEIPT_META[event.receiptStatus].tone}>{RECEIPT_META[event.receiptStatus].label}</Badge>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Seg
            value={event.resultStatus}
            options={RESULT_OPTIONS}
            onChange={v => onResultChange && onResultChange(event.id, v)}
          />
          {event.url && (
            <IconBtn name="ext" size={32} title="원글 링크" onClick={() => window.open(event.url, '_blank')} />
          )}
          <IconBtn name="pencil" size={32} title="수정" active={edit} onClick={() => setEdit(e => !e)} />
          <IconBtn name="undo" size={32} title="대기로 되돌리기" onClick={handleDelete} />
        </div>
      </div>

      {event.resultStatus === 'won' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>수령</span>
          <Seg
            value={event.receiptStatus || 'unclaimed'}
            options={RECEIPT_OPTIONS}
            onChange={v => onMetaChange && onMetaChange(event.id, { receiptStatus: v })}
          />
          {event.receiptStatus === 'received' && (
            <span style={{ fontSize: 11.5, color: 'var(--win-text)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon name="check" size={12} /> 완료
            </span>
          )}
        </div>
      )}

      {edit && (
        <div style={{ padding: 14, borderTop: '1px dashed var(--border)', background: 'var(--surface-2)', animation: 'fadeUp .2s var(--ease-out)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
              발표일
              <input
                type="date"
                defaultValue={event.resultAnnouncementDate ? event.resultAnnouncementDate.slice(0, 10) : ''}
                onBlur={e => handleAnnounceDateBlur(e.target.value ? new Date(e.target.value + 'T18:00:00+09:00').toISOString() : '')}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
              메모
              <input
                type="text"
                defaultValue={event.winningMemo || ''}
                placeholder="예: 커뮤니티 탭에서 발표"
                onBlur={e => onMetaChange && onMetaChange(event.id, { winningMemo: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          {event.resultStatus === 'won' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 11 }}>
              <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
                상품명
                <input
                  type="text"
                  defaultValue={event.prizeTitle || ''}
                  placeholder="예: 스타벅스 기프티콘"
                  onBlur={e => onMetaChange && onMetaChange(event.id, { prizeTitle: e.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
                당첨 금액 <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(자연어 OK)</span>
                <input
                  type="text"
                  defaultValue={event.prizeAmount ? wonShort(event.prizeAmount).replace('원', '') : ''}
                  placeholder="예: 1만 5000"
                  onBlur={e => onMetaChange && onMetaChange(event.id, { prizeAmount: e.target.value })}
                  style={inputStyle}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InboxScreen({ events, isLoading, selectedFilter, onSelectFilter, totalAmount, onResultChange, onAnnouncementChange, onMetaChange, onDelete }) {
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const ka = inboxSortKey(a);
      const kb = inboxSortKey(b);
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const diff = (ka[i] || 0) - (kb[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  }, [events]);

  const counts = useMemo(() => {
    const c = {};
    INBOX_FILTERS.forEach(f => { c[f.key] = events.filter(e => matchInbox(e, f.key)).length; });
    return c;
  }, [events]);

  const list = sorted.filter(e => matchInbox(e, selectedFilter || 'all'));

  return (
    <div>
      <SummaryStrip events={events} totalAmount={totalAmount} />
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {INBOX_FILTERS.map(f => (
          <Chip
            key={f.key}
            active={(selectedFilter || 'all') === f.key}
            tone={f.tone}
            count={counts[f.key]}
            onClick={() => onSelectFilter && onSelectFilter(f.key)}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      {isLoading ? (
        <Empty icon="refresh" title="불러오는 중입니다." />
      ) : list.length === 0 ? (
        <Empty icon="inbox" title="해당하는 응모가 없어요" sub="필터를 바꿔보세요." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(ev => (
            <InboxRow
              key={ev.id}
              event={ev}
              onResultChange={onResultChange}
              onAnnouncementChange={onAnnouncementChange}
              onMetaChange={onMetaChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}