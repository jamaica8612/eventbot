import './primitives.css';

const cx = (...classes) => classes.filter(Boolean).join(' ');

/* ---------- Button ---------- */
export function Button({
  variant = 'default',
  size,
  block,
  kbd,
  className,
  children,
  ...rest
}) {
  const cls = cx(
    'v2-btn',
    variant && variant !== 'default' && `v2-btn--${variant}`,
    size && `v2-btn--${size}`,
    block && 'v2-btn--block',
    className,
  );
  return (
    <button className={cls} {...rest}>
      {children}
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  );
}

export function IconButton({ size, className, children, ...rest }) {
  return (
    <button className={cx('v2-icon-btn', size && `v2-icon-btn--${size}`, className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
export function Badge({ variant, dot, className, children }) {
  return (
    <span className={cx('v2-badge', dot && 'v2-badge--dot', variant && `v2-badge--${variant}`, className)}>
      {!dot && children}
    </span>
  );
}

/* ---------- Tag ---------- */
export function Tag({ variant, className, children }) {
  return (
    <span className={cx('v2-tag', variant && `v2-tag--${variant}`, className)}>
      {children}
    </span>
  );
}

/* ---------- Pill (filter chip) ---------- */
export function Pill({ on, className, children, ...rest }) {
  return (
    <button className={cx('v2-pill', on && 'v2-pill--on', className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ variant, interactive, flush, className, children, ...rest }) {
  return (
    <div
      className={cx(
        'v2-card',
        interactive && 'v2-card--interactive',
        flush && 'v2-card--flush',
        variant && `v2-card--${variant}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ size, square, className, children }) {
  return (
    <span className={cx('v2-avatar', size && `v2-avatar--${size}`, square && 'v2-avatar--square', className)}>
      {children}
    </span>
  );
}

/* ---------- Input ---------- */
export function Input({ className, ...rest }) {
  return <input className={cx('v2-input', className)} {...rest} />;
}

/* ---------- Layout helpers ---------- */
export function Stack({ size, className, children, ...rest }) {
  return <div className={cx('v2-stack', size && `v2-stack--${size}`, className)} {...rest}>{children}</div>;
}
export function Inline({ size, className, children, ...rest }) {
  return <div className={cx('v2-inline', size && `v2-inline--${size}`, className)} {...rest}>{children}</div>;
}
export function Divider({ vertical }) {
  return <hr className={cx('v2-divider', vertical && 'v2-divider--vertical')} />;
}
