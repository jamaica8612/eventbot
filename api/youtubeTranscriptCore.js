import { spawn } from 'node:child_process';

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
    if (match) return match[1].split('&')[0].split('?')[0];
  }
  return '';
}

export async function fetchYoutubeTranscript(input) {
  const context = await fetchYoutubeContext(input);
  if (!context.transcript?.text) {
    throw new Error(context.transcriptError || '유튜브 자막을 가져오지 못했습니다.');
  }
  return {
    videoId: context.videoId,
    ...context.transcript,
  };
}

export async function fetchYoutubeContext({ videoId, url, audioFallback = false }) {
  const resolvedVideoId = videoId || extractVideoId(url);
  if (!resolvedVideoId) throw new Error('유튜브 영상 ID를 찾지 못했습니다.');

  const watchUrl = `https://www.youtube.com/watch?v=${resolvedVideoId}`;
  const watchResponse = await fetch(watchUrl, { headers: WATCH_HEADERS });
  const html = await watchResponse.text();
  if (!watchResponse.ok) {
    throw new Error(`유튜브 영상 페이지를 열 수 없습니다. (${watchResponse.status})`);
  }

  const playerResponse = extractPlayerResponse(html);
  const metadata = extractVideoMetadata(playerResponse, html, watchUrl);
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  let transcript = null;
  let transcriptError = '';

  try {
    transcript = await fetchTranscriptWithYoutubeTranscriptApi(resolvedVideoId);
  } catch (error) {
    transcriptError = error.message || 'youtube-transcript-api로 자막을 가져오지 못했습니다.';
  }

  if (!transcript?.text) {
    if (tracks.length === 0) {
      transcriptError = `${transcriptError} 공개 자막이나 자동 자막이 없는 영상입니다.`.trim();
    } else {
      try {
        transcript = await fetchTranscriptTrack({
          videoId: resolvedVideoId,
          watchUrl,
          track: chooseCaptionTrack(tracks),
        });
        transcriptError = '';
      } catch (error) {
        transcriptError = error.message || '유튜브 자막을 가져오지 못했습니다.';
      }
    }
  }

  if (!transcript?.text && audioFallback) {
    try {
      transcript = await transcribeYoutubeAudio(watchUrl);
      transcriptError = '';
    } catch (error) {
      transcriptError = `${transcriptError || '자막을 가져오지 못했습니다.'} 오디오 음성인식도 실패했습니다: ${
        error.message || error
      }`;
    }
  }

  return {
    videoId: resolvedVideoId,
    url: watchUrl,
    ...metadata,
    availableCaptionLanguages: tracks.map((track) => ({
      code: track.languageCode ?? '',
      name: getText(track.name),
      isGenerated: track.kind === 'asr',
    })),
    transcript,
    transcriptError,
  };
}

function fetchTranscriptWithYoutubeTranscriptApi(videoId) {
  return runPythonJson(['scripts/youtube_transcript_api_fetch.py', videoId]).then((payload) => ({
    videoId,
    language: payload.language || '',
    languageName: payload.languageName || 'youtube-transcript-api',
    isGenerated: Boolean(payload.isGenerated),
    source: payload.source || 'youtube-transcript-api',
    lines: payload.lines || [],
    text: payload.text || '',
  }));
}

function transcribeYoutubeAudio(watchUrl) {
  return runPythonJson([
    'scripts/youtube_audio_transcribe.py',
    watchUrl,
    process.env.YOUTUBE_WHISPER_MODEL || 'base',
  ]).then((payload) => ({
    videoId: extractVideoId(watchUrl),
    language: payload.language || 'ko',
    languageName: '오디오 음성인식',
    isGenerated: true,
    source: payload.source || 'audio-whisper',
    model: payload.model || '',
    lines: payload.lines || [],
    text: payload.text || '',
  }));
}

function runPythonJson(args) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
    const child = spawn(python, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const payload = JSON.parse(stdout || '{}');
        if (code !== 0 || payload.error) {
          reject(new Error(payload.error || stderr.trim() || `Python exited with code ${code}`));
          return;
        }
        resolve(payload);
      } catch (error) {
        reject(new Error(`Python 결과를 읽지 못했습니다: ${error.message}`));
      }
    });
  });
}

async function fetchTranscriptTrack({ videoId, watchUrl, track }) {
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
    videoId,
    language: track.languageCode ?? '',
    languageName: getText(track.name),
    isGenerated: track.kind === 'asr',
    source: 'youtube-timedtext',
    lines,
    text: lines.join('\n'),
  };
}

function extractVideoMetadata(playerResponse, html, watchUrl) {
  const details = playerResponse?.videoDetails ?? {};
  const microformat = playerResponse?.microformat?.playerMicroformatRenderer ?? {};
  const owner = microformat.ownerChannelName || details.author || '';
  const description = details.shortDescription || getText(microformat.description);
  const publishDate = microformat.publishDate || microformat.uploadDate || '';

  return {
    title: details.title || getMetaContent(html, 'name="title"') || '',
    channelName: owner,
    channelUrl: microformat.ownerProfileUrl
      ? new URL(microformat.ownerProfileUrl, watchUrl).toString()
      : '',
    description,
    publishDate,
    lengthSeconds: details.lengthSeconds ? Number(details.lengthSeconds) : null,
    viewCount: details.viewCount ? Number(details.viewCount) : null,
    keywords: Array.isArray(details.keywords) ? details.keywords.slice(0, 20) : [],
    category: microformat.category || '',
    thumbnailUrl: details.thumbnail?.thumbnails?.at(-1)?.url || '',
  };
}

function extractPlayerResponse(html) {
  const marker = 'ytInitialPlayerResponse = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('유튜브 플레이어 정보를 찾지 못했습니다.');

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
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
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

function getText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.simpleText) return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text).join('');
  return '';
}

function getMetaContent(html, selectorPart) {
  const pattern = new RegExp(`<meta[^>]*${selectorPart}[^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeHtml(html.match(pattern)?.[1] ?? '');
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'");
}
