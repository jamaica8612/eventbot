import { Icon, Badge, Button, Avatar } from '../../components/index.jsx';
import { wonShort } from '../../lib/domain.js';
import { formatDate } from '../../utils/format.js';

const CRAWLER_STATUS = {
  ok:        { label: '정상',    tone: 'win',    dot: 'var(--win)' },
  fail:      { label: '실패',    tone: 'urgent', dot: 'var(--urgent)' },
  requested: { label: '요청됨',  tone: 'warn',   dot: 'var(--warn)' },
  empty:     { label: '신규 없음', tone: 'muted', dot: 'var(--text-3)' },
};

const TH = { padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '11px 12px', fontSize: 13, color: 'var(--text)' };
const TDN = { padding: '11px 12px', fontSize: 13, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

export function AdminScreen({ users = [], crawler = {}, onUserChange, onCrawl }) {
  const status = crawler.status || 'empty';
  const cs = CRAWLER_STATUS[status] || CRAWLER_STATUS.empty;

  const approved = users.filter(u => u.approved);
  const pending  = users.filter(u => !u.approved);
  const totalEntered  = approved.reduce((s, u) => s + (u.stats?.entered  || 0), 0);
  const totalWin      = approved.reduce((s, u) => s + (u.stats?.win      || 0), 0);
  const totalUnrec    = approved.reduce((s, u) => s + (u.stats?.unreceived || 0), 0);
  const avgRate       = approved.length
    ? Math.round(approved.reduce((s, u) => s + (u.stats?.rate || 0), 0) / approved.length * 10) / 10
    : 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 크롤러 상태 카드 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18, boxShadow: 'var(--shadow-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Icon name="refresh" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750 }}>크롤러 상태</h3>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
            color: cs.tone === 'win' ? 'var(--win-text)' : cs.tone === 'urgent' ? 'var(--urgent-text)' : 'var(--text-2)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 99, background: cs.dot,
              boxShadow: status === 'ok' ? '0 0 0 3px var(--win-weak)' : 'none',
            }} />
            {cs.label}
          </span>
          <Button variant="primary" icon="play" size="sm" style={{ marginLeft: 'auto' }} onClick={onCrawl}>
            크롤링 실행
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {[
            { l: 'DB 총 개수',   v: (crawler.total || 0).toLocaleString(), s: '건' },
            { l: '24시간 신규',  v: '+' + (crawler.new24h || 0),            s: '건' },
            { l: '최신 수집',    v: formatDate(crawler.latestCollectedAt),  s: '' },
            { l: '마지막 성공',  v: formatDate(crawler.lastSuccessAt),      s: '' },
          ].map(x => (
            <div key={x.l} style={{ padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{x.l}</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                {x.v}
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}> {x.s}</span>
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
          { l: '승인 대기',   v: pending.length,  att: pending.length > 0 },
          { l: '응모완료',    v: totalEntered },
          { l: '평균 당첨률', v: avgRate + '%' },
          { l: '미수령',      v: totalUnrec,       att: totalUnrec > 0 },
        ].map(s => (
          <div key={s.l} style={{
            flex: '1 1 110px', minWidth: 100, padding: '13px 15px', borderRadius: 'var(--r-md)',
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'right' }}>
                <th style={{ ...TH, textAlign: 'left' }}>계정</th>
                <th style={TH}>대기</th><th style={TH}>임시</th><th style={TH}>응모</th>
                <th style={TH}>당첨</th><th style={TH}>당첨률</th><th style={TH}>미수령</th><th style={TH}>당첨금</th>
                <th style={{ ...TH, textAlign: 'center' }}>권한</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const initial = (u.displayName || u.display_name || u.email || '?').slice(0, 1).toUpperCase();
                const isAdmin = u.isAdmin || u.is_admin;
                const name    = u.displayName || u.display_name || u.email;
                const stats   = u.stats || {};
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.approved ? 1 : 0.85 }}>
                    <td style={{ ...TD, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={initial} size={32} admin={isAdmin} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {name}
                            {!u.approved && <Badge tone="warn">승인 대기</Badge>}
                            {isAdmin && <Badge tone="accent">관리자</Badge>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={TDN}>{stats.waiting  ?? '-'}</td>
                    <td style={TDN}>{stats.draft     ?? '-'}</td>
                    <td style={TDN}>{stats.entered   ?? '-'}</td>
                    <td style={{ ...TDN, color: 'var(--win-text)', fontWeight: 700 }}>{stats.win ?? '-'}</td>
                    <td style={TDN}>{stats.rate != null ? stats.rate + '%' : '-'}</td>
                    <td style={{ ...TDN, color: stats.unreceived ? 'var(--urgent-text)' : 'var(--text-3)', fontWeight: stats.unreceived ? 700 : 400 }}>
                      {stats.unreceived ?? '-'}
                    </td>
                    <td style={TDN}>{stats.prize != null ? wonShort(stats.prize) : '-'}</td>
                    <td style={{ ...TD, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Button
                          size="sm"
                          variant={u.approved ? 'soft' : 'primary'}
                          onClick={() => onUserChange(u.id, { approved: !u.approved })}
                        >
                          {u.approved ? '승인해제' : '승인'}
                        </Button>
                        <Button
                          size="sm"
                          variant={isAdmin ? 'outline' : 'ghost'}
                          disabled={!u.approved}
                          onClick={() => onUserChange(u.id, { is_admin: !isAdmin })}
                        >
                          {isAdmin ? '관리자 해제' : '관리자 지정'}
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
