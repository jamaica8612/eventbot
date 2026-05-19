import './AdminPanel.css';
import { useEffect, useMemo, useState } from 'react';
import { Button, Tag } from './primitives.jsx';
import {
  loadSupabaseAdminUsers,
  updateSupabaseProfileAccess,
} from '../../storage/supabaseEventStorage.js';

function formatWon(amount) {
  const n = Number(amount) || 0;
  if (n === 0) return '0원';
  return `${n.toLocaleString('ko-KR')}원`;
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

function buildSummary(users) {
  return users.reduce(
    (acc, user) => {
      const stats = normalizeStats(user.stats);
      acc.total += 1;
      if (!user.approved) acc.pending += 1;
      acc.done += stats.done;
      acc.won += stats.won;
      acc.lost += stats.lost;
      acc.unreceived += stats.unreceived;
      acc.winRate = getWinRateLabel(acc);
      return acc;
    },
    { total: 0, pending: 0, done: 0, won: 0, lost: 0, unreceived: 0, winRate: '-' },
  );
}

export function AdminPanel({ onNotice }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [error, setError] = useState('');
  const summary = useMemo(() => buildSummary(users), [users]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    loadSupabaseAdminUsers()
      .then((list) => { if (active) setUsers(list); })
      .catch((err) => {
        if (!active) return;
        const message = err?.message || '관리자 정보를 불러오지 못했습니다.';
        setError(message);
        onNotice?.({ type: 'warning', message });
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [onNotice]);

  async function updateAccess(user, patch) {
    setUpdatingUserId(user.user_id);
    try {
      await updateSupabaseProfileAccess(user.user_id, patch);
      setUsers((cur) =>
        cur.map((item) =>
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
    } catch (err) {
      onNotice?.({ type: 'warning', message: err?.message || '권한 저장 실패' });
    } finally {
      setUpdatingUserId('');
    }
  }

  if (isLoading) return <div className="v2-admin__empty">사용자 정보를 불러오는 중…</div>;
  if (error) return <div className="v2-admin__empty">{error}</div>;
  if (users.length === 0) return <div className="v2-admin__empty">등록된 사용자가 없습니다.</div>;

  return (
    <div className="v2-admin">
      <div className="v2-admin__summary">
        <SummaryCard label="전체 사용자" value={`${summary.total}명`} />
        <SummaryCard label="승인 대기" value={`${summary.pending}명`} attention={summary.pending > 0} />
        <SummaryCard label="응모완료" value={`${summary.done}건`} />
        <SummaryCard label="당첨률" value={summary.winRate} />
        <SummaryCard label="미수령" value={`${summary.unreceived}건`} attention={summary.unreceived > 0} />
      </div>

      {users.map((user) => (
        <UserRow
          key={user.user_id}
          user={user}
          isUpdating={updatingUserId === user.user_id}
          onUpdateAccess={updateAccess}
        />
      ))}
    </div>
  );
}

function SummaryCard({ label, value, attention }) {
  return (
    <div className={'v2-admin__summary-card' + (attention ? ' is-attention' : '')}>
      <span className="v2-admin__summary-label">{label}</span>
      <strong className="v2-admin__summary-value">{value}</strong>
    </div>
  );
}

function UserRow({ user, isUpdating, onUpdateAccess }) {
  const stats = normalizeStats(user.stats);
  const name = user.display_name || user.email || '이름 없음';

  return (
    <article className={'v2-admin__user' + (!user.approved ? ' is-pending' : '')}>
      <div className="v2-admin__user-head">
        <div className="v2-admin__user-id">
          <span className="v2-admin__user-name">{name}</span>
          <span className="v2-admin__user-email">{user.email || user.user_id}</span>
        </div>
        <div className="v2-admin__user-badges">
          <Tag variant={user.approved ? 'success' : 'warn'}>
            {user.approved ? '승인됨' : '승인 대기'}
          </Tag>
          {user.is_admin && <Tag variant="brand">관리자</Tag>}
        </div>
      </div>

      <div className="v2-admin__user-stats">
        <Stat label="대기" value={stats.ready} />
        <Stat label="임시" value={stats.later} />
        <Stat label="응모" value={stats.done} />
        <Stat label="당첨" value={stats.won} />
        <Stat label="당첨률" value={getWinRateLabel(stats)} />
        <Stat label="미수령" value={stats.unreceived} />
        <Stat label="당첨금" value={formatWon(stats.prizeAmount)} />
      </div>

      <div className="v2-admin__user-actions">
        <Button
          size="sm"
          variant={user.approved ? 'ghost' : 'primary'}
          disabled={isUpdating}
          onClick={() => onUpdateAccess(user, { approved: !user.approved })}
        >
          {user.approved ? '승인 해제' : '승인'}
        </Button>
        <Button
          size="sm"
          variant={user.is_admin ? 'ghost' : 'outline'}
          disabled={isUpdating}
          onClick={() => onUpdateAccess(user, { isAdmin: !user.is_admin })}
        >
          {user.is_admin ? '관리자 해제' : '관리자 지정'}
        </Button>
      </div>
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="v2-admin__user-stat">
      <span className="v2-admin__user-stat-label">{label}</span>
      <strong className="v2-admin__user-stat-value">{value}</strong>
    </div>
  );
}
