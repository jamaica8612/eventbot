/* ============================================================
   당첨노트 v2 — 관리자 콘솔
   프로토타입 screens-admin 디자인 + 현재 데이터/함수(AdminPanel.jsx와 동일 계약).
   user: {user_id, display_name, email, approved, is_admin, stats{ready,later,done,won,lost,unreceived,prizeAmount}}
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Avatar, Badge, Btn, Empty } from '../../components/primitives.jsx';
import { wonShort } from '../../lib/domain.js';
import { loadSupabaseAdminUsers, updateSupabaseProfileAccess } from '../../../storage/supabaseEventStorage.js';

const th = { padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '11px 12px', fontSize: 13, color: 'var(--text)' };
const tdn = { padding: '11px 12px', fontSize: 13, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

export function AdminScreen({ crawlerStatus, isCrawling, onCrawl, onNotice, onSummaryChange }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const summary = useMemo(() => buildAdminSummary(users), [users]);

  useEffect(() => { onSummaryChange?.(summary); }, [onSummaryChange, summary]);

  useEffect(() => {
    let isMounted = true;
    loadSupabaseAdminUsers()
      .then((loaded) => { if (isMounted) setUsers(loaded); })
      .catch((error) => onNotice?.({ type: 'warning', message: error.message || '관리자 정보를 불러오지 못했습니다.' }))
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [onNotice]);

  async function updateAccess(user, patch) {
    setUpdatingId(user.user_id);
    try {
      await updateSupabaseProfileAccess(user.user_id, patch);
      setUsers((cur) => cur.map((item) => (item.user_id === user.user_id
        ? { ...item, ...(typeof patch.approved === 'boolean' ? { approved: patch.approved } : {}), ...(typeof patch.isAdmin === 'boolean' ? { is_admin: patch.isAdmin } : {}) }
        : item)));
      onNotice?.({ type: 'success', message: '사용자 권한을 저장했습니다.' });
    } catch (error) {
      onNotice?.({ type: 'warning', message: error.message || '사용자 권한 저장에 실패했습니다.' });
    } finally {
      setUpdatingId('');
    }
  }

  const recentSeen = Number.isFinite(crawlerStatus?.recentSeen24h)
    ? crawlerStatus.recentSeen24h
    : Array.isArray(crawlerStatus?.recentEvents) ? crawlerStatus.recentEvents.length : null;
  const ci = getCrawlerStatusInfo(crawlerStatus?.status, recentSeen);
  const total = Number.isFinite(crawlerStatus?.totalEvents) ? crawlerStatus.totalEvents : '-';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* crawler card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18, boxShadow: 'var(--shadow-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Icon name="refresh" size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750 }}>크롤러 상태</h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: ci.color }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: ci.dot }} />{ci.label}
          </span>
          <Btn variant="primary" icon="play" size="sm" style={{ marginLeft: 'auto' }} onClick={onCrawl} disabled={isCrawling}>
            {isCrawling ? '크롤링 요청 중' : '크롤링 실행'}
          </Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {[
            { l: 'DB 총 개수', v: typeof total === 'number' ? total.toLocaleString() : total, s: '건' },
            { l: '24시간 신규', v: recentSeen === null ? '-' : `+${recentSeen}`, s: '건' },
            { l: '최신 수집', v: formatCrawlerDate(crawlerStatus?.latestSeenAt), s: '' },
            { l: '마지막 성공', v: formatCrawlerDate(crawlerStatus?.lastSuccessAt ?? crawlerStatus?.checkedAt), s: '' },
          ].map((x) => (
            <div key={x.l} style={{ padding: '11px 13px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{x.l}</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{x.v}<span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}> {x.s}</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>“크롤링 실행”은 GitHub Actions 워크플로를 트리거합니다.</div>
      </div>

      {/* operation summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { l: '전체 사용자', v: `${summary.total}명` },
          { l: '승인 대기', v: `${summary.pending}명`, att: summary.pending > 0 },
          { l: '응모완료', v: `${summary.done}건` },
          { l: '평균 당첨률', v: summary.winRate },
          { l: '미수령', v: `${summary.unreceived}건`, att: summary.unreceived > 0 },
        ].map((s) => (
          <div key={s.l} style={{ flex: '1 1 110px', minWidth: 100, padding: '13px 15px', borderRadius: 'var(--r-md)', background: s.att ? 'var(--warn-weak)' : 'var(--surface)', border: '1px solid ' + (s.att ? 'var(--warn)' : 'var(--border)') }}>
            <div style={{ fontSize: 11.5, fontWeight: 650, color: s.att ? 'var(--warn-text)' : 'var(--text-3)' }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 23, fontWeight: 800, marginTop: 3, color: s.att ? 'var(--warn-text)' : 'var(--text)' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* user management */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="user" size={16} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750 }}>사용자 관리</h3>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{isLoading ? '불러오는 중' : `${users.length}명`}</span>
        </div>
        {isLoading ? (
          <Empty icon="user" title="사용자 정보를 불러오는 중…" />
        ) : users.length === 0 ? (
          <Empty icon="user" title="등록된 사용자가 없어요" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'right' }}>
                  <th style={{ ...th, textAlign: 'left' }}>계정</th>
                  <th style={th}>대기</th><th style={th}>임시</th><th style={th}>응모</th>
                  <th style={th}>당첨</th><th style={th}>당첨률</th><th style={th}>미수령</th><th style={th}>당첨금</th>
                  <th style={{ ...th, textAlign: 'center' }}>권한</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const stats = normalizeStats(u.stats);
                  const name = u.display_name || u.email || '이름 없음';
                  const updating = updatingId === u.user_id;
                  return (
                    <tr key={u.user_id} style={{ borderTop: '1px solid var(--border)', opacity: u.approved ? 1 : 0.85 }}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initial={(name[0] || '?').toUpperCase()} size={32} admin={u.is_admin} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 650, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {name}
                              {!u.approved && <Badge tone="warn">승인 대기</Badge>}
                              {u.is_admin && <Badge tone="accent">관리자</Badge>}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{u.email || u.user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdn}>{stats.ready}</td>
                      <td style={tdn}>{stats.later}</td>
                      <td style={tdn}>{stats.done}</td>
                      <td style={{ ...tdn, color: 'var(--win-text)', fontWeight: 700 }}>{stats.won}</td>
                      <td style={tdn}>{getWinRateLabel(stats)}</td>
                      <td style={{ ...tdn, color: stats.unreceived ? 'var(--urgent-text)' : 'var(--text-3)', fontWeight: stats.unreceived ? 700 : 400 }}>{stats.unreceived}</td>
                      <td style={tdn}>{wonShort(stats.prizeAmount)}</td>
                      <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <Btn size="sm" variant={u.approved ? 'soft' : 'primary'} disabled={updating} onClick={() => updateAccess(u, { approved: !u.approved })}>
                            {u.approved ? '승인해제' : '승인'}
                          </Btn>
                          <Btn size="sm" variant={u.is_admin ? 'outline' : 'ghost'} disabled={updating || !u.approved} onClick={() => updateAccess(u, { isAdmin: !u.is_admin })}>
                            {u.is_admin ? '관리자 해제' : '관리자 지정'}
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getCrawlerStatusInfo(status, recentSeen) {
  if (status === 'failure') return { kind: 'failure', label: '크롤링 실패', dot: 'var(--urgent)', color: 'var(--urgent-text)' };
  if (status === 'requested') return { kind: 'requested', label: '크롤링 요청됨', dot: 'var(--warn)', color: 'var(--warn-text)' };
  if (recentSeen === 0) return { kind: 'quiet', label: '신규 수집 없음', dot: 'var(--text-3)', color: 'var(--text-2)' };
  return { kind: 'success', label: '크롤링 정상', dot: 'var(--win)', color: 'var(--win-text)' };
}

function formatCrawlerDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function buildAdminSummary(users) {
  return users.reduce((s, user) => {
    const stats = normalizeStats(user.stats);
    s.total += 1;
    if (!user.approved) s.pending += 1;
    s.done += stats.done;
    s.won += stats.won;
    s.lost += stats.lost;
    s.unreceived += stats.unreceived;
    s.winRate = getWinRateLabel(s);
    return s;
  }, { total: 0, pending: 0, done: 0, won: 0, lost: 0, unreceived: 0, winRate: '-' });
}

function normalizeStats(stats = {}) {
  return {
    ready: Number(stats.ready) || 0,
    later: Number(stats.later) || 0,
    done: Number(stats.done) || 0,
    won: Number(stats.won) || 0,
    lost: Number(stats.lost) || 0,
    unreceived: Number(stats.unreceived) || 0,
    prizeAmount: Number(stats.prizeAmount) || 0,
  };
}

function getWinRateLabel(stats) {
  const decided = stats.won + stats.lost;
  if (decided === 0) return '-';
  return `${Math.round((stats.won / decided) * 100)}%`;
}
