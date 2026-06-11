import { getFilterLabel } from '../constants.js';
import { formatWon } from '../utils/format.js';

const navIcons = {
  ready: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),
  todayDeadline: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v4M17 3v4M4 9h16" />
      <path d="M5 5h14v15H5z" />
      <path d="M12 12v4l3 1" />
    </svg>
  ),
  later: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v16l-6-3-6 3z" />
      <path d="M9 8h6M9 12h4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4z" />
      <path d="M4 13h4l2 3h4l2-3h4" />
    </svg>
  ),
};

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
          <span className="nav-icon">{navIcons[item.value]}</span>
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
