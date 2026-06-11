import { siNaver, siYoutube } from 'simple-icons';

export function PlatformBadge({ platform }) {
  const config = getPlatformConfig(platform);

  return (
    <span className={`platform-badge platform-badge-${config.kind}`} title={platform}>
      <span className="platform-badge-icon" aria-hidden="true">{config.icon}</span>
      <span className="platform-badge-label">{platform}</span>
    </span>
  );
}

function getPlatformConfig(platform = '') {
  const text = String(platform).toLocaleLowerCase('ko-KR');
  if (text.includes('유튜브') || text.includes('youtube')) {
    return { kind: 'youtube', icon: <BrandIcon icon={siYoutube} /> };
  }
  if (text.includes('네이버') || text.includes('naver')) {
    return { kind: 'naver', icon: <BrandIcon icon={siNaver} /> };
  }
  if (text.includes('블로그')) {
    return { kind: 'blog', icon: <BrandIcon icon={siNaver} /> };
  }
  if (text.includes('홈페이지') || text.includes('웹') || text.includes('site')) {
    return { kind: 'home', icon: <HomeIcon /> };
  }
  return { kind: 'event', icon: <SparkIcon /> };
}

function BrandIcon({ icon }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d={icon.path} />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path d="M3.2 9.2 10 3.6l6.8 5.6" />
      <path d="M5.2 8.2v8h9.6v-8" />
      <path d="M8.3 16.2v-4.5h3.4v4.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" focusable="false">
      <path d="M10 2.8 11.8 8l5.4 2-5.4 2L10 17.2 8.2 12l-5.4-2 5.4-2L10 2.8Z" />
    </svg>
  );
}
