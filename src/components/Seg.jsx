export function Seg({ value, options, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`} role="group">
      {options.map((opt) => (
        <button
          key={opt.v}
          type="button"
          className={`seg-item${value === opt.v ? ` is-active${opt.tone ? ` seg-${opt.tone}` : ''}` : ''}`}
          onClick={() => onChange(opt.v)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
