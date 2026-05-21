const YOUTUBE_URL_PATTERN = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/gi;

const DIRECT_URL_KEYS = [
  'applyTargetUrl',
  'apply_target_url',
  'applyUrl',
  'apply_url',
  'url',
  'originalUrl',
  'original_url',
  'resolvedApplyUrl',
  'resolved_apply_url',
  'applyTargetResolvedUrl',
  'apply_target_resolved_url',
  'resolvedUrl',
  'resolved_url',
  'finalUrl',
  'final_url',
  'finalApplyUrl',
  'final_apply_url',
  'targetUrl',
  'target_url',
  'linkUrl',
  'link_url',
  'youtubeUrl',
  'youtube_url',
  'youtubeVideoUrl',
  'youtube_video_url',
  'youtubeWatchUrl',
  'youtube_watch_url',
  'videoUrl',
  'video_url',
];

const URL_ARRAY_KEYS = [
  'externalLinks',
  'external_links',
  'links',
  'urls',
  'youtubeLinks',
  'youtube_links',
  'videoLinks',
  'video_links',
];

const TEXT_KEYS = [
  'originalText',
  'contentText',
  'bodyText',
  'detailText',
  'description',
  'memo',
];

const TEXT_ARRAY_KEYS = [
  'originalLines',
  'contentLines',
  'bodyLines',
  'detailMetaLines',
];

export function buildYoutubeLinks(event = {}) {
  const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const acceptsRedirectLinks = isYoutubeEvent(event);
  const candidates = [
    ...collectUrlCandidates(event),
    ...collectUrlCandidates(raw),
    ...extractYoutubeUrlsFromText(collectTextCandidates(event).join('\n')),
    ...extractYoutubeUrlsFromText(collectTextCandidates(raw).join('\n')),
  ];

  return candidates
    .map(normalizeYoutubeUrl)
    .filter(Boolean)
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .filter((url) => extractYoutubeVideoId(url) || (acceptsRedirectLinks && isLikelyRedirectUrl(url)));
}

export function hasYoutubeLink(event = {}) {
  return buildYoutubeLinks(event).length > 0;
}

export function extractYoutubeVideoId(url) {
  const value = String(url ?? '');
  return (
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    value.match(/youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1] ??
    ''
  );
}

function collectUrlCandidates(source = {}) {
  if (!source || typeof source !== 'object') return [];

  const values = DIRECT_URL_KEYS.map((key) => source[key]);
  for (const key of URL_ARRAY_KEYS) {
    const value = source[key];
    if (Array.isArray(value)) {
      values.push(...value);
    }
  }

  return values.flatMap((value) => {
    if (typeof value === 'string') return extractYoutubeUrlsFromText(value).length ? extractYoutubeUrlsFromText(value) : [value];
    if (value && typeof value === 'object') return collectUrlCandidates(value);
    return [];
  });
}

function collectTextCandidates(source = {}) {
  if (!source || typeof source !== 'object') return [];

  const values = TEXT_KEYS.map((key) => source[key]);
  for (const key of TEXT_ARRAY_KEYS) {
    const value = source[key];
    if (Array.isArray(value)) {
      values.push(...value);
    }
  }
  return values.filter(Boolean).map((value) => String(value));
}

function extractYoutubeUrlsFromText(text) {
  return String(text ?? '').match(YOUTUBE_URL_PATTERN) ?? [];
}

function normalizeYoutubeUrl(url) {
  const value = String(url ?? '').trim();
  if (!value) return '';
  const match = value.match(YOUTUBE_URL_PATTERN);
  return (match?.[0] ?? value).replace(/[),.;\]]+$/, '');
}

function isYoutubeEvent(event = {}) {
  const raw = event.raw && typeof event.raw === 'object' ? event.raw : {};
  const text = [
    event.platform,
    event.source,
    event.title,
    raw.platform,
    raw.source,
    raw.title,
  ]
    .filter(Boolean)
    .join(' ');
  return /유튜브|youtube/i.test(text);
}

function isLikelyRedirectUrl(url) {
  return /^https?:\/\//i.test(String(url ?? ''));
}
