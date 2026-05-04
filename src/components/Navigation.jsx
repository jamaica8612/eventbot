import { getFilterLabel } from '../constants.js';
import { formatWon } from '../utils/format.js';

export function SummaryItem({ active, label, value, onClick }) {
  return (
    <button
      type="button"
      className={`summary-item${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

export function ManageMetrics({ events, totalAmount }) {
  const unreceivedCount = events.filter((event) => event.receiptStatus !== 'received').length;
  return (
    <div className="manage-metrics" aria-label="관리 요약">
      <div>
        <span>총</span>
        <strong>{events.length}건</strong>
      </div>
      <div>
        <span>미수령</span>
        <strong>{unreceivedCount}건</strong>
      </div>
      <div>
        <span>총 금액</span>
        <strong>{formatWon(totalAmount)}</strong>
      </div>
    </div>
  );
}

export function BottomNav({ counts, filters, selectedFilter, onSelect }) {
  return (
    <nav className="bottom-nav" aria-label="주요 분류">
      {filters.map((item) => (
        <button
          key={item.value}
          type="button"
          className={selectedFilter === item.value ? 'is-active' : ''}
          onClick={() => onSelect(item.value)}
        >
          <span>{getFilterLabel(item)}</span>
          <strong>{counts[item.countKey]}</strong>
        </button>
      ))}
    </nav>
  );
}

export function DesktopNav({ counts, filters, selectedFilter, onSelect }) {
  return (
    <nav className="desktop-nav" aria-label="PC 주요 분류">
      {filters.map((item) => (
        <button
          key={item.value}
          type="button"
          className={selectedFilter === item.value ? 'is-active' : ''}
          onClick={() => onSelect(item.value)}
        >
          <span>{getFilterLabel(item)}</span>
          <strong>{counts[item.countKey]}</strong>
        </button>
      ))}
    </nav>
  );
}
