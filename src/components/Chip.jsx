export function Chip({ active, onClick, children, count, tone, disabled, className = '' }) {
  const toneClass = tone ? `chip-${tone}` : '';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`chip ${active ? 'is-active' : ''} ${toneClass} ${className}`}
    >
      {children}
      {count != null && <span className="chip-count tnum">{count}</span>}
    </button>
  );
}
