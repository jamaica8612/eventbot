import { Icon } from './Icon.jsx';

export function Empty({ icon = 'inbox', title, sub }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrap">
        <Icon name={icon} size={26} />
      </div>
      {title && <div className="empty-title">{title}</div>}
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  );
}
