import { Icon } from './Icon.jsx';

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconRight,
  children,
  onClick,
  disabled,
  full,
  title,
  type = 'button',
  className = '',
  style,
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`btn-base btn-${size} btn-${variant}${full ? ' btn-full' : ''} ${className}`}
      style={style}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 17 : 15} stroke={2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} stroke={2} />}
    </button>
  );
}

export function IconBtn({ name, onClick, active, title, size = 34, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`icon-btn${active ? ' is-active' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} size={size > 36 ? 20 : 17} />
    </button>
  );
}
