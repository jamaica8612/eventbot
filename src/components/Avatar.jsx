import { Icon } from './Icon.jsx';

export function Avatar({ initial, size = 36, admin }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
      {admin && (
        <span className="avatar-admin-badge" aria-hidden="true">
          <Icon name="shield" size={9} stroke={2.5} />
        </span>
      )}
    </span>
  );
}
