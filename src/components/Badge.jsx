import { Icon } from './Icon.jsx';

export function Badge({ tone = 'muted', children, icon, solid, className = '' }) {
  const cls = solid
    ? `badge badge-solid-${tone}`
    : `badge badge-${tone}`;
  return (
    <span className={`${cls} ${className}`}>
      {icon && <Icon name={icon} size={12} stroke={2.2} />}
      {children}
    </span>
  );
}
