import { spawn } from 'node:child_process';
import { generateCommentCandidates } from './youtubeCommentGenerator.js';

const COMMENTS_TIMEOUT_MS = 25000;
const COMMENT_CANDIDATES_TIMEOUT_MS = 80000;

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
  return {
    videoId: context.videoId,
    source: 'youtube-video-context',
    lines: [],
    text: '',
  };
}

export async function fetchYoutubeContext({ videoId, url, eventInfo, mode = 'candidates' }) {
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
  const transcript = await fetchTranscriptSafe(tracks);

  const comments = await fetchCommentsSafe(resolvedVideoId);

  let commentCandidates = [];
  let commentCandidatesError = '';
  if (mode !== 'context') {
    try {
      commentCandidates = await withTimeout(
        generateCommentCandidates({
          videoUrl: watchUrl,
          eventInfo: eventInfo ?? {},
          comments,
          timeoutMs: COMMENT_CANDIDATES_TIMEOUT_MS,
        }),
        COMMENT_CANDIDATES_TIMEOUT_MS + 5000,
        'Gemini 댓글 생성 시간이 너무 오래 걸렸습니다.',
      );
    } catch (error) {
      commentCandidatesError = error.message || 'Gemini 댓글 생성에 실패했습니다.';
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
    transcriptError: transcript ? '' : '사용 가능한 공개 자막을 찾지 못했습니다.',
    comments,
    commentCandidates,
    commentCandidatesError,
  };
}

async function fetchCommentsSafe(videoId) {
  try {
    const payload = await runPythonJson(['scripts/youtube_comments_fetch.py', videoId, '50'], {
      timeoutMs: COMMENTS_TIMEOUT_MS,
    });
    return Array.isArray(payload.comments) ? payload.comments : [];
  } catch {
    return [];
  }
}

async function fetchTranscriptSafe(tracks) {
  try {
    const track = chooseCaptionTrack(tracks);
    if (!track?.baseUrl) return null;
    const url = new URL(String(track.baseUrl));
    url.searchParams.set('fmt', 'json3');
    const response = await fetch(url.toString(), { headers: WATCH_HEADERS });
    if (!response.ok) return null;
    const payload = await response.json();
    const lines = (Array.isArray(payload.events) ? payload.events : [])
      .map((event) =>
        (Array.isArray(event.segs) ? event.segs : [])
          .map((segment) => String(segment.utf8 ?? ''))
          .join(''),
      )
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const compactLines = dedupeAdjacentLines(lines).slice(0, 160);
    return {
      languageCode: String(track.languageCode ?? ''),
      isGenerated: track.kind === 'asr',
      lines: compactLines,
      text: compactLines.join('\n'),
    };
  } catch {
    return null;
  }
}

function chooseCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  return (
    tracks.find((track) => String(track.languageCode ?? '').toLowerCase().startsWith('ko')) ??
    tracks.find((track) => /korean|한국|한글/i.test(getText(track.name))) ??
    tracks.find((track) => String(track.languageCode ?? '').toLowerCase().startsWith('en')) ??
    tracks[0]
  );
}

function dedupeAdjacentLines(lines) {
  const result = [];
  for (const line of lines) {
    if (line && line !== result.at(-1)) result.push(line);
  }
  return result;
}

function runPythonJson(args, options = {}) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
    let settled = false;
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
    const timeoutId = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          reject(new Error(`Python 작업 시간이 너무 오래 걸렸습니다: ${args[0]}`));
        }, options.timeoutMs)
      : null;

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
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

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
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
