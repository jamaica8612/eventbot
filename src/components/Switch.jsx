export function Switch({ on, onChange, label, id }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      id={id}
      onClick={() => onChange(!on)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <span className={`switch-track${on ? ' is-on' : ''}`} aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      {label && <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 550 }}>{label}</span>}
    </button>
  );
}
