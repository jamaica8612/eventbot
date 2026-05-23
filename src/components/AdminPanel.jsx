import { useEffect, useMemo, useState } from 'react';
import { formatWon } from '../utils/format.js';
import {
  loadSupabaseAdminUsers,
  updateSupabaseProfileAccess,
} from '../storage/supabaseEventStorage.js';

export function AdminPanel({
  onSummaryChange,
  onNotice,
  crawlerStatus,
  isCrawling,
  onCrawl,
}) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState('');
  const summary = useMemo(() => buildAdminSummary(users), [users]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  useEffect(() => {
    let isMounted = true;
    loadUsers().finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };

    async function loadUsers() {
      try {
        const loadedUsers = await loadSupabaseAdminUsers();
        if (isMounted) setUsers(loadedUsers);
      } catch (error) {
        onNotice?.({
          type: 'warning',
          message: error.message || '관리자 정보를 불러오지 못했습니다.',
        });
      }
    }
  }, [onNotice]);

  async function updateAccess(user, patch) {
    setUpdatingUserId(user.user_id);
    try {
      await updateSupabaseProfileAccess(user.user_id, patch);
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.user_id === user.user_id
            ? {
                ...item,
                ...(typeof patch.approved === 'boolean' ? { approved: patch.approved } : {}),
                ...(typeof patch.isAdmin === 'boolean' ? { is_admin: patch.isAdmin } : {}),
              }
            : item,
        ),
      );
      onNotice?.({ type: 'success', message: '사용자 권한을 저장했습니다.' });
    } catch (error) {
      onNotice?.({
        type: 'warning',
        message: error.message || '사용자 권한 저장에 실패했습니다.',
      });
    } finally {
      setUpdatingUserId('');
    }
  }

  return (
    <section className="admin-board" aria-label="관리자">
      <section className="admin-hero-panel">
        <div className="admin-hero-copy">
          <span>ADMIN</span>
          <strong>관리자 콘솔</strong>
          <p>사용자 승인, 운영 현황, 크롤링 상태를 한 곳에서 확인합니다.</p>
        </div>
        <CrawlerControlPanel
          status={crawlerStatus}
          isCrawling={isCrawling}
          onCrawl={onCrawl}
        />
      </section>

      <div className="admin-summary">
        <AdminSummaryCard label="전체 사용자" value={`${summary.total}명`} />
        <AdminSummaryCard label="승인 대기" value={`${summary.pending}명`} attention={summary.pending > 0} />
        <AdminSummaryCard label="응모완료" value={`${summary.done}건`} />
        <AdminSummaryCard label="당첨률" value={summary.winRate} />
        <AdminSummaryCard label="미수령" value={`${summary.unreceived}건`} attention={summary.unreceived > 0} />
      </div>

      <section className="admin-user-section">
        <div className="admin-section-head">
          <div>
            <span>USERS</span>
            <strong>사용자 관리</strong>
          </div>
          <b>{isLoading ? '불러오는 중' : `${users.length}명`}</b>
        </div>

        {isLoading ? (
          <p className="empty-message">사용자 정보를 불러오는 중입니다.</p>
        ) : users.length === 0 ? (
          <p className="empty-message">등록된 사용자가 없습니다.</p>
        ) : (
          <div className="admin-user-list">
            {users.map((user) => (
              <AdminUserRow
                key={user.user_id}
                user={user}
                isUpdating={updatingUserId === user.user_id}
                onUpdateAccess={updateAccess}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function CrawlerControlPanel({ status, isCrawling, onCrawl }) {
  const recentSeen = Number.isFinite(status?.recentSeen24h)
    ? status.recentSeen24h
    : Array.isArray(status?.recentEvents)
      ? status.recentEvents.length
      : null;
  const statusInfo = getCrawlerStatusInfo(status?.status, recentSeen);
  const checkedAt = formatCrawlerDate(status?.checkedAt ?? status?.updatedAt);
  const lastSuccessAt = formatCrawlerDate(status?.lastSuccessAt ?? status?.checkedAt);
  const latestSeenAt = formatCrawlerDate(status?.latestSeenAt);
  const total = Number.isFinite(status?.totalEvents) ? status.totalEvents : '-';
  const recentLabel = recentSeen === null ? '-' : recentSeen;

  return (
    <div className={`admin-crawler-card admin-crawler-${statusInfo.kind}`}>
      <div className="admin-crawler-top">
        <span>CRAWLER</span>
        <strong>{statusInfo.label}</strong>
      </div>
      <div className="admin-crawler-stats">
        <span>DB {total}개</span>
        <span>24시간 {recentLabel}개</span>
        <span>최신 {latestSeenAt}</span>
      </div>
      <p>마지막 성공 {lastSuccessAt} · 상태 확인 {checkedAt}</p>
      <button type="button" onClick={onCrawl} disabled={isCrawling}>
        {isCrawling ? '크롤링 요청 중' : '크롤링 실행'}
      </button>
    </div>
  );
}

function AdminSummaryCard({ label, value, attention = false }) {
  return (
    <div className={attention ? 'is-attention' : ''}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdminUserRow({ user, isUpdating, onUpdateAccess }) {
  const stats = normalizeStats(user.stats);
  const name = user.display_name || user.email || '이름 없음';

  return (
    <article className={`admin-user-row${!user.approved ? ' is-pending' : ''}`}>
      <div className="admin-user-main">
        <div>
          <strong>{name}</strong>
          <span>{user.email || user.user_id}</span>
        </div>
        <div className="admin-user-badges">
          <span className={user.approved ? 'is-approved' : 'is-pending'}>
            {user.approved ? '승인됨' : '승인 대기'}
          </span>
          {user.is_admin ? <span className="is-admin">관리자</span> : null}
        </div>
      </div>

      <div className="admin-user-stats">
        <Metric label="대기" value={stats.ready} />
        <Metric label="임시" value={stats.later} />
        <Metric label="응모" value={stats.done} />
        <Metric label="당첨" value={stats.won} />
        <Metric label="당첨률" value={getWinRateLabel(stats)} />
        <Metric label="미수령" value={stats.unreceived} />
        <Metric label="당첨금" value={formatWon(stats.prizeAmount)} />
      </div>

      <div className="admin-user-actions">
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onUpdateAccess(user, { approved: !user.approved })}
        >
          {user.approved ? '승인 해제' : '승인'}
        </button>
        <button
          type="button"
          disabled={isUpdating}
          className={user.is_admin ? 'is-selected' : ''}
          onClick={() => onUpdateAccess(user, { isAdmin: !user.is_admin })}
        >
          {user.is_admin ? '관리자 해제' : '관리자 지정'}
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCrawlerStatusInfo(status, recentSeen) {
  if (status === 'failure') return { kind: 'failure', label: '크롤링 실패' };
  if (status === 'requested') return { kind: 'requested', label: '크롤링 요청됨' };
  if (recentSeen === 0) return { kind: 'quiet', label: '신규 수집 없음' };
  return { kind: 'success', label: '크롤링 정상' };
}

function formatCrawlerDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildAdminSummary(users) {
  return users.reduce(
    (summary, user) => {
      const stats = normalizeStats(user.stats);
      summary.total += 1;
      if (!user.approved) summary.pending += 1;
      summary.done += stats.done;
      summary.won += stats.won;
      summary.lost += stats.lost;
      summary.unreceived += stats.unreceived;
      summary.winRate = getWinRateLabel(summary);
      return summary;
    },
    { total: 0, pending: 0, done: 0, won: 0, lost: 0, unreceived: 0, winRate: '-' },
  );
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
