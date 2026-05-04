const WATCH_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

export function extractVideoId(value = '') {
  const text = String(value);
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/,
    /^[A-Za-z0-9_-]{6,}$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].split('&')[0].split('?')[0];
    }
  }
  return '';
}

export async function fetchYoutubeTranscript({ videoId, url }) {
  const resolvedVideoId = videoId || extractVideoId(url);
  if (!resolvedVideoId) {
    throw new Error('유튜브 영상 ID를 찾지 못했습니다.');
  }

  const watchUrl = `https://www.youtube.com/watch?v=${resolvedVideoId}`;
  const watchResponse = await fetch(watchUrl, { headers: WATCH_HEADERS });
  const html = await watchResponse.text();
  if (!watchResponse.ok) {
    throw new Error(`유튜브 영상 페이지를 열 수 없습니다. (${watchResponse.status})`);
  }

  const playerResponse = extractPlayerResponse(html);
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) {
    throw new Error('공개 자막이나 자동 자막이 없는 영상입니다.');
  }

  const track = chooseCaptionTrack(tracks);
  const transcriptUrl = withJsonFormat(track.baseUrl);
  const transcriptResponse = await fetch(transcriptUrl, {
    headers: { ...WATCH_HEADERS, referer: watchUrl },
  });
  const transcriptPayload = await transcriptResponse.text();

  if (transcriptResponse.status === 429 || transcriptPayload.includes('<title>Sorry')) {
    throw new Error('현재 IP에서 유튜브 자막 요청이 제한되었습니다. 잠시 뒤 다시 시도하세요.');
  }
  if (!transcriptResponse.ok) {
    throw new Error(`유튜브 자막을 가져오지 못했습니다. (${transcriptResponse.status})`);
  }

  const snippets = parseTranscriptPayload(transcriptPayload);
  const lines = compactTranscriptLines(snippets);
  if (lines.length === 0) {
    throw new Error('자막은 찾았지만 읽을 수 있는 문장이 없습니다.');
  }

  return {
    videoId: resolvedVideoId,
    language: track.languageCode ?? '',
    languageName: track.name?.simpleText ?? track.name?.runs?.map((run) => run.text).join('') ?? '',
    isGenerated: track.kind === 'asr',
    lines,
    text: lines.join('\n'),
  };
}

function extractPlayerResponse(html) {
  const marker = 'ytInitialPlayerResponse = ';
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error('유튜브 플레이어 정보를 찾지 못했습니다.');
  }

  const jsonStart = start + marker.length;
  const jsonText = readBalancedJson(html, jsonStart);
  return JSON.parse(jsonText);
}

function readBalancedJson(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') inString = true;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  throw new Error('유튜브 플레이어 JSON을 끝까지 읽지 못했습니다.');
}

function chooseCaptionTrack(tracks) {
  return (
    tracks.find((track) => track.languageCode === 'ko') ??
    tracks.find((track) => track.languageCode?.startsWith('ko')) ??
    tracks.find((track) => track.languageCode === 'en') ??
    tracks[0]
  );
}

function withJsonFormat(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set('fmt', 'json3');
  return url.toString();
}

function parseTranscriptPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    return (parsed.events ?? [])
      .flatMap((event) => event.segs ?? [])
      .map((segment) => segment.utf8)
      .filter(Boolean);
  } catch {
    return [...payload.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((match) =>
      decodeHtml(match[1]),
    );
  }
}

function compactTranscriptLines(snippets) {
  const lines = [];
  let current = '';

  for (const snippet of snippets) {
    const value = String(snippet).replace(/\s+/g, ' ').trim();
    if (!value) continue;
    if (current && current.length + value.length > 180) {
      lines.push(current);
      current = value;
    } else {
      current = `${current} ${value}`.trim();
    }
  }
  if (current) lines.push(current);

  return lines.slice(0, 80);
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'");
}
