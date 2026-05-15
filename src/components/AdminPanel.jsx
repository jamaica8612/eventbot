import { useEffect, useMemo, useState } from 'react';
import { formatWon } from '../utils/format.js';
import {
  loadSupabaseAdminUsers,
  updateSupabaseProfileAccess,
} from '../storage/supabaseEventStorage.js';

export function AdminPanel({ onSummaryChange, onNotice }) {
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
      <div className="admin-summary">
        <AdminSummaryCard label="전체 사용자" value={`${summary.total}명`} />
        <AdminSummaryCard label="승인 대기" value={`${summary.pending}명`} attention={summary.pending > 0} />
        <AdminSummaryCard label="응모완료" value={`${summary.done}건`} />
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
          <span className={user.approved ? 'is-approved' : 'is-pending'}>{user.approved ? '승인됨' : '승인 대기'}</span>
          {user.is_admin ? <span className="is-admin">관리자</span> : null}
        </div>
      </div>

      <div className="admin-user-stats">
        <Metric label="대기" value={stats.ready} />
        <Metric label="임시" value={stats.later} />
        <Metric label="응모" value={stats.done} />
        <Metric label="당첨" value={stats.won} />
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

function buildAdminSummary(users) {
  return users.reduce(
    (summary, user) => {
      const stats = normalizeStats(user.stats);
      summary.total += 1;
      if (!user.approved) summary.pending += 1;
      summary.done += stats.done;
      summary.unreceived += stats.unreceived;
      return summary;
    },
    { total: 0, pending: 0, done: 0, unreceived: 0 },
  );
}

function normalizeStats(stats = {}) {
  return {
    ready: Number(stats.ready) || 0,
    later: Number(stats.later) || 0,
    done: Number(stats.done) || 0,
    won: Number(stats.won) || 0,
    unreceived: Number(stats.unreceived) || 0,
    prizeAmount: Number(stats.prizeAmount) || 0,
  };
}
