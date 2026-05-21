import { useEffect, useMemo, useState } from 'react';
import { formatWon } from '../utils/format.js';
import {
  loadSupabaseAdminUsers,
  updateSupabaseProfileAccess,
} from '../storage/supabaseEventStorage.js';

export function AdminPanel({ onSummaryChange, onNotice, crawlerStatus, isCrawling, onCrawl }) {
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

  if (isLoading) {
    return <p className="empty-message">사용자 정보를 불러오는 중입니다.</p>;
  }

  if (users.length === 0) {
    return <p className="empty-message">등록된 사용자가 없습니다.</p>;
  }

  return (
    <section className="admin-board" aria-label="관리자">
      <section className="admin-control-panel">
        <div>
          <span>ACCESS CONTROL</span>
          <strong>{summary.pending > 0 ? `${summary.pending}명 승인 대기` : '승인 대기 없음'}</strong>
          <p>사용자 승인과 관리자 권한을 한 곳에서 관리합니다.</p>
        </div>
        <div className="admin-control-meter">
          <span>전체 사용자</span>
          <strong>{summary.total}명</strong>
        </div>
      </section>

      <section className="admin-crawler-panel" aria-label="크롤링 운영">
        <div>
          <span>CRAWLER</span>
          <strong>{getCrawlerStatusLabel(crawlerStatus)}</strong>
          <p>{getCrawlerSummary(crawlerStatus)}</p>
        </div>
        <div className="admin-crawler-actions">
          <button type="button" onClick={onCrawl} disabled={isCrawling}>
            {isCrawling ? '크롤링 중' : '크롤링하기'}
          </button>
          <small>마지막 성공 {formatCrawlerDate(crawlerStatus?.lastSuccessAt ?? crawlerStatus?.checkedAt)}</small>
        </div>
      </section>

      <div className="admin-summary">
        <AdminSummaryCard label="전체 사용자" value={`${summary.total}명`} />
        <AdminSummaryCard label="승인 대기" value={`${summary.pending}명`} attention={summary.pending > 0} />
        <AdminSummaryCard label="응모완료" value={`${summary.done}건`} />
        <AdminSummaryCard label="당첨률" value={summary.winRate} />
        <AdminSummaryCard label="미수령" value={`${summary.unreceived}건`} attention={summary.unreceived > 0} />
      </div>

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
    </section>
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

function getCrawlerStatusLabel(status) {
  if (!status) return '상태 확인 전';
  if (status.status === 'failure') return '크롤링 실패';
  if (status.status === 'requested') return '크롤링 요청됨';
  const recentSeen = Number.isFinite(status.recentSeen24h)
    ? status.recentSeen24h
    : Array.isArray(status.recentEvents)
      ? status.recentEvents.length
      : null;
  if (recentSeen === 0) return '신규 수집 없음';
  return '크롤링 정상';
}

function getCrawlerSummary(status) {
  if (!status) return '아직 크롤링 상태를 불러오지 못했습니다.';
  if (status.status === 'failure') {
    return status.failureMessage || '최근 크롤링이 실패했습니다.';
  }
  const total = Number.isFinite(status.totalEvents) ? status.totalEvents : '-';
  const recentSeen = Number.isFinite(status.recentSeen24h)
    ? status.recentSeen24h
    : Array.isArray(status.recentEvents)
      ? status.recentEvents.length
      : '-';
  const latestSeenAt = formatCrawlerDate(status.latestSeenAt);
  return `DB ${total}개 · 최근 24시간 ${recentSeen}개 · 최신 수집 ${latestSeenAt}`;
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
