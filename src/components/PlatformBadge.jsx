function getPlatformMeta(platform = '') {
  const p = String(platform).toLowerCase();
  if (p.includes('youtube') || p.includes('유튜브')) {
    return { cls: 'yt', label: 'YT', title: 'YouTube' };
  }
  if (p.includes('naver') || p.includes('네이버') || p.includes('블로그')) {
    return { cls: 'naver', label: 'N', title: '네이버' };
  }
  if (p.includes('home') || p.includes('홈페이지') || p.includes('웹')) {
    return { cls: 'home', label: 'H', title: '홈페이지' };
  }
  const first = String(platform).slice(0, 1).toUpperCase() || '?';
  return { cls: 'other', label: first, title: platform };
}

export function PlatformBadge({ platform, size = 'sm' }) {
  const meta = getPlatformMeta(platform);
  return (
    <span
      className={`platform-badge platform-badge-${meta.cls} platform-badge-${size}`}
      title={meta.title}
      aria-label={meta.title}
    >
      {meta.label}
    </span>
  );
}
