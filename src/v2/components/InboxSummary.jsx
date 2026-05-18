import './InboxSummary.css';

function formatKRW(n) {
  if (!Number.isFinite(n) || n <= 0) return '0원';
  if (n >= 1e8) return `${(n / 1e8).toFixed(n % 1e8 === 0 ? 0 : 1)}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만원`;
  return `${n.toLocaleString('ko-KR')}원`;
}

/* ============================================================
   InboxSummary — 수령함 / 결과 뷰 상단 KPI 카드
   props:
     events — 전체 이벤트 (참여한 것만 KPI 계산에 사용)
   ============================================================ */
export function InboxSummary({ events }) {
  const participated = events.filter((e) => e.status === 'done');
  const won  = participated.filter((e) => e.resultStatus === 'won');
  const lost = participated.filter((e) => e.resultStatus === 'lost');
  const unclaimed = won.filter((e) => e.receiptStatus !== 'received');

  const totalPrize = won.reduce((sum, e) => sum + (Number(e.prizeAmountValue) || 0), 0);
  const settled = won.length + lost.length;
  const winRate = settled > 0 ? Math.round((won.length / settled) * 1000) / 10 : null;

  return (
    <div className="v2-summary">
      <div className="v2-summary__card v2-summary__card--accent">
        <div className="v2-summary__lbl">누적 당첨금</div>
        <div className="v2-summary__val v2-summary__val--accent">{formatKRW(totalPrize)}</div>
        <div className="v2-summary__sub">{won.length}건 당첨</div>
      </div>

      <div className="v2-summary__card">
        <div className="v2-summary__lbl">당첨률</div>
        <div className="v2-summary__val">
          {winRate != null ? `${winRate}%` : '—'}
        </div>
        <div className="v2-summary__sub">
          참여 {participated.length}건 / 결과 {settled}건
        </div>
      </div>

      <div className="v2-summary__card">
        <div className="v2-summary__lbl">미수령</div>
        <div className={`v2-summary__val${unclaimed.length > 0 ? ' v2-summary__val--warn' : ''}`}>
          {unclaimed.length}건
        </div>
        <div className="v2-summary__sub">
          {unclaimed.length > 0 ? '확인 필요' : '모두 수령 완료'}
        </div>
      </div>
    </div>
  );
}
