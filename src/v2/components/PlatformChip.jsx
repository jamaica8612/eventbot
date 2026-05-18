import './PlatformChip.css';

const META = {
  '인스타그램': { key: 'ig', icon: '📷', short: 'IG' },
  '유튜브':     { key: 'yt', icon: '▶', short: 'YT' },
  '카카오톡':   { key: 'kk', icon: '💬', short: 'KT' },
};

function metaFor(platform) {
  return META[platform] || { key: 'other', icon: '🔗', short: '·' };
}

/* 작은 인라인 칩 (제목 옆/리스트 메타) */
export function PlatformChip({ platform, showLabel = true }) {
  const m = metaFor(platform);
  return (
    <span className={`v2-pfchip v2-pfchip--${m.key}`}>
      <span className="v2-pfchip__dot">{m.icon}</span>
      {showLabel && <span>{platform}</span>}
    </span>
  );
}

/* 카드 좌측의 큰 색상 썸네일 */
export function PlatformThumb({ platform }) {
  const m = metaFor(platform);
  return (
    <span className={`v2-pfthumb v2-pfthumb--${m.key}`} aria-label={platform}>
      {m.icon}
    </span>
  );
}
