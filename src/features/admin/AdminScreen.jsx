import { Icon } from '../../components/Icon.jsx';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { wonShort } from '../../lib/domain.js';

const CRAWLER_STATUS = {
  ok:        { label: '정상',    tone: 'win',    dot: 'var(--win)' },
  failure:   { label: '실패',    tone: 'urgent', dot: 'var(--urgent)' },
  requested: { label: '요청됨',  tone: 'warn',   dot: 'var(--warn)' },
  empty:     { label: '신규 없음', tone: 'muted', dot: 'var(--text-3)' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso; }
}

const th = { padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text-3)' };
const td = { padding: '11px 12px', fontSize: 13, color: 'var(--text)' };
const tdn = { padding: '11px 12px', fontSize: 13, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

export function AdminScreen({
  users = [],
  crawlerStatus,
  isCrawling,
  onCrawl,
  onNotice,
  onUserChange,
  updatingUserId,
}) {
  const cs = CRAWLER_STATUS[crawlerStatus?.status] || CRAWLER_STATUS.empty;
  const approved = users.filter(u => u.approved);
  const pending = users.filter(u => !u.approved);

  function handleUserChange(userId, patch) {
    onUserChange?.(users.find((user) => user.id === userId || user.user_id === userId), patch);
    onNotice && onNotice({ type: 'info', message: '사용자 정보 변경 중…' });
  }

  const totalEntered = approved.reduce((s, u) => s + (u.stats?.done || 0), 0);
  const totalUnrec = approved.reduce((s, u) => s + (u.stats?.unreceived || 0), 0);
  const totalWin = approved.reduce((s, u) => s + (u.stats?.won || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 크롤러 카드 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18, boxShadow: 'var(--shadow-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Icon name="refresh" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750 }}>크롤러 상태</h3>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
            color: cs.tone === 'win' ? 'var(--win-text)' : cs.tone === 'urgent' ? 'var(--urgent-text)' : 'var(--text-2)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: cs.dot, boxShadow: crawlerStatus?.status === 'ok' ? '0 0 0 3px var(--win-weak)' : 'none' }} />
            {cs.label}
          </span>
          <Button variant="primary" icon="play" size="sm" style={{ marginLeft: 'auto' }} onClick={onCrawl} disabled={isCrawling}>
            {isCrawling ? '요청 중…' : '크롤링 실행'}
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {[
            { l: 'DB 총 개수', v: (crawlerStatus?.totalEvents || 0).toLocaleString(), s: '건' },
            { l: '24시간 신규', v: '+' + (crawlerStatus?.recentSeen24h || 0), s: '건' },
            { l: '최신 수집', v: fmtDate(crawlerStatus?.lastCrawledAt), s: '' },
            { l: '마지막 성공', v: fmtDate(crawlerStatus?.lastSuccessAt), s: '' },
          ].map(x => (
            <div key={x.l} style={{ padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{x.l}</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                {x.v}<span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}> {x.s}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>
          "크롤링 실행"은 GitHub Actions 워크플로를 트리거합니다.
        </div>
      </div>

      {/* 운영 요약 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { l: '전체 사용자', v: users.length },
          { l: '승인 대기', v: pending.length, att: pending.length > 0 },
          { l: '응모완료', v: totalEntered },
          { l: '미수령', v: totalUnrec, att: totalUnrec > 0 },
        ].map(s => (
          <div key={s.l} style={{
            flex: '1 1 110px', minWidth: 100, padding: '13px 15px',
            borderRadius: 'var(--r-md)',
            background: s.att ? 'var(--warn-weak)' : 'var(--surface)',
            border: '1px solid ' + (s.att ? 'var(--warn)' : 'var(--border)'),
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 650, color: s.att ? 'var(--warn-text)' : 'var(--text-3)' }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 23, fontWeight: 800, marginTop: 3, color: s.att ? 'var(--warn-text)' : 'var(--text)' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 사용자 관리 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="user" size={16} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750 }}>사용자 관리</h3>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{users.length}명</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
            <thead>
              <tr style={{ textAlign: 'right' }}>
                <th style={{ ...th, textAlign: 'left' }}>계정</th>
                <th style={th}>응모</th>
                <th style={th}>당첨</th>
                <th style={th}>미수령</th>
                <th style={th}>당첨금</th>
                <th style={{ ...th, textAlign: 'center' }}>권한</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const initials = (u.display_name || u.email || '?').slice(0, 2).toUpperCase();
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.approved ? 1 : .85 }}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={initials} size={32} admin={u.is_admin} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {u.display_name || u.email?.split('@')[0] || '사용자'}
                            {!u.approved && <Badge tone="warn">승인 대기</Badge>}
                            {u.is_admin && <Badge tone="accent">관리자</Badge>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdn}>{u.stats?.done || 0}</td>
                    <td style={{ ...tdn, color: 'var(--win-text)', fontWeight: 700 }}>{u.stats?.won || 0}</td>
                    <td style={{ ...tdn, color: (u.stats?.unreceived || 0) ? 'var(--urgent-text)' : 'var(--text-3)', fontWeight: (u.stats?.unreceived || 0) ? 700 : 400 }}>{u.stats?.unreceived || 0}</td>
                    <td style={tdn}>{wonShort(u.stats?.prize || 0)}</td>
                    <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Button
                          size="sm"
                          variant={u.approved ? 'soft' : 'primary'}
                          disabled={updatingUserId === (u.user_id || u.id)}
                          onClick={() => handleUserChange(u.id, { approved: !u.approved })}
                        >
                          {u.approved ? '승인해제' : '승인'}
                        </Button>
                        <Button
                          size="sm"
                          variant={u.is_admin ? 'outline' : 'ghost'}
                          disabled={!u.approved || updatingUserId === (u.user_id || u.id)}
                          onClick={() => handleUserChange(u.id, { is_admin: !u.is_admin })}
                        >
                          {u.is_admin ? '관리자 해제' : '관리자 지정'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
