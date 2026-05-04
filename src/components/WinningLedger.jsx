import { useMemo, useState } from 'react';
import { receiptLabels } from '../constants.js';
import {
  PRIZE_FALLBACK,
  buildWinningMonthGroups,
  getPrizeDisplay,
  getWinningDateValue,
  sortWinningEvents,
} from '../utils/eventModel.js';
import { formatDate, formatWon, parsePrizeAmount } from '../utils/format.js';

export function WinningLedger({ events, totalAmount, onMetaChange }) {
  const [ledgerView, setLedgerView] = useState('latest');
  const sortedEvents = useMemo(() => sortWinningEvents(events), [events]);
  const monthlyGroups = useMemo(() => buildWinningMonthGroups(sortedEvents), [sortedEvents]);
  const unreceivedCount = events.filter((event) => event.receiptStatus !== 'received').length;

  return (
    <div className="winning-ledger">
      <div className="ledger-summary">
        <div>
          <span>총 당첨</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>입력 금액</span>
          <strong>{formatWon(totalAmount)}</strong>
        </div>
        <div>
          <span>미수령</span>
          <strong>{unreceivedCount}</strong>
        </div>
      </div>

      <div className="ledger-view-toggle" aria-label="당첨 장부 보기 전환">
        <button
          type="button"
          className={ledgerView === 'latest' ? 'is-active' : ''}
          onClick={() => setLedgerView('latest')}
        >
          최신순
        </button>
        <button
          type="button"
          className={ledgerView === 'monthly' ? 'is-active' : ''}
          onClick={() => setLedgerView('monthly')}
        >
          월별
        </button>
      </div>

      {events.length > 0 ? (
        ledgerView === 'monthly' ? (
          <div className="ledger-month-list">
            {monthlyGroups.map((group) => (
              <section className="ledger-month-group" key={group.key}>
                <div className="ledger-month-head">
                  <strong>{group.label}</strong>
                  <span>
                    {group.events.length}건 · {formatWon(group.totalAmount)} · 미수령 {group.unreceivedCount}
                  </span>
                </div>
                <div className="ledger-table" role="table" aria-label={`${group.label} 당첨 관리 목록`}>
                  {group.events.map((event) => (
                    <WinningLedgerRow key={event.id} event={event} onMetaChange={onMetaChange} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="ledger-table" role="table" aria-label="당첨 관리 목록">
            {sortedEvents.map((event) => (
              <WinningLedgerRow key={event.id} event={event} onMetaChange={onMetaChange} />
            ))}
          </div>
        )
      ) : (
        <p className="empty-message">아직 당첨으로 표시한 이벤트가 없습니다.</p>
      )}
    </div>
  );
}

function WinningLedgerRow({ event, onMetaChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const prizeTitle = event.prizeTitle || getPrizeDisplay(event);
  const displayPrize = prizeTitle === PRIZE_FALLBACK ? '' : prizeTitle;

  return (
    <article className="ledger-row">
      <div className="ledger-title-block">
        <time>{formatDate(getWinningDateValue(event))}</time>
        <div className="ledger-title">
          <strong>{event.title}</strong>
          <span>{event.source}</span>
        </div>
      </div>
      <span className="ledger-prize">{displayPrize || event.title}</span>
      <span className="ledger-amount">{formatWon(parsePrizeAmount(event.prizeAmount))}</span>
      <span className="ledger-receipt">{receiptLabels[event.receiptStatus ?? 'unclaimed']}</span>
      <span className="ledger-memo">{event.winningMemo || '-'}</span>
      <button
        type="button"
        className="manage-edit-button"
        onClick={() => setIsEditing((value) => !value)}
      >
        수정
      </button>
      {isEditing ? (
        <div className="ledger-edit-panel">
          <label className="prize-title-field">
            <span>상품명</span>
            <input
              placeholder="예: 스타벅스 아메리카노"
              value={displayPrize}
              onChange={(changeEvent) =>
                onMetaChange(event.id, { prizeTitle: changeEvent.target.value })
              }
            />
          </label>
          <label className="amount-field">
            <span>금액</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={event.prizeAmount ?? ''}
              onChange={(changeEvent) =>
                onMetaChange(event.id, { prizeAmount: changeEvent.target.value })
              }
            />
          </label>
          <label className="receipt-field">
            <span>상태</span>
            <select
              value={event.receiptStatus ?? 'unclaimed'}
              onChange={(changeEvent) =>
                onMetaChange(event.id, { receiptStatus: changeEvent.target.value })
              }
            >
              {Object.entries(receiptLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="winning-memo-field">
            <span>메모</span>
            <input
              placeholder="수령 조건, 문의번호, 계정 등"
              value={event.winningMemo ?? ''}
              onChange={(changeEvent) =>
                onMetaChange(event.id, { winningMemo: changeEvent.target.value })
              }
            />
          </label>
        </div>
      ) : null}
    </article>
  );
}
