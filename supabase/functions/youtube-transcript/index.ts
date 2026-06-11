const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const COMMENT_SETTINGS_KEY = 'comment_settings';
const DEFAULT_COMMENT_PROMPT = `이 GPT, 이벤트 댓글 마스터는 사용자가 제공한 이벤트 정보 및 다른 참가자들의 댓글을 참고하여 독특하고 창의적인 댓글을 생성합니다. 이벤트의 분위기를 더욱 활기차고 긍정적으로 만드는 데 초점을 맞춥니다. 다른 참가자들의 댓글은 이벤트의 분위기와 참가자들의 반응을 이해하는 데 사용되며, 이를 바탕으로 참신하고 긍정적인 메시지를 담은 댓글을 제작합니다. 각 댓글은 이벤트의 주제와 맥락에 맞추어 개성있고 매력적으로 구성되며, 중복된 내용이나 아이디어는 피합니다. 경품 상품에 대한 내용과 영상이나 글에 대한 평가적인 내용은 포함하지 않으며, 사용자의 요청에 따라 댓글의 톤과 스타일을 조절할 수 있습니다. 부적절한 내용이나 불쾌감을 주는 요소는 배제합니다. 댓글은 이벤트 심사위원의 입장에서 1등을 줄 수 있을 만한 수준으로 길게 만듭니다. 인용 부호 사용을 최소화하여 강조를 표현합니다. 이모티콘을 사용하지 않는다. AI가 자주 사용하는 말투는 쓰지 않고 정말 사람처럼 글을 쓴다.`;
const SHOULD_ATTACH_VIDEO_FILE = Deno.env.get('GEMINI_ATTACH_VIDEO_FILE') === '1';
const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);
const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-eventbot-token',
};
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSCODE_DISABLED = true;

type CommentSettings = {
  geminiApiKey: string;
  commentPrompt: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (!PASSCODE_DISABLED) {
    const passcodeSecret = Deno.env.get('EVENTBOT_PASSCODE');
    if (!passcodeSecret) {
      return json({ error: 'Passcode secret is not configured.' }, 500);
    }

    const token = request.headers.get('x-eventbot-token') ?? '';
    if (!(await verifyToken(token, passcodeSecret))) {
      return json({ error: 'Invalid access token.' }, 401);
    }
  }

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const requestUrl = new URL(request.url);
    const videoId =
      body.videoId ||
      requestUrl.searchParams.get('videoId') ||
      extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
    const mode = body.mode === 'context' ? 'context' : 'candidates';
    const userSettings = await loadRequestCommentSettings(request);
    const context = await fetchYoutubeContext({
      videoId,
      eventInfo: body.eventInfo ?? {},
      mode,
      userSettings,
    });
    return json(context);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to collect YouTube information.' },
      400,
    );
  }
});

async function verifyToken(token: string, secret: string) {
  const [issuedAt, signature] = token.split('.');
  const issuedAtNumber = Number(issuedAt);
  if (!issuedAt || !signature || !Number.isFinite(issuedAtNumber)) return false;
  if (Date.now() - issuedAtNumber > TOKEN_TTL_MS) return false;
  return constantTimeEqual(signature, await sign(issuedAt, secret));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

async function sign(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function toBase64Url(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

async function loadRequestCommentSettings(request: Request): Promise<CommentSettings> {
  const token = extractBearerToken(request.headers.get('authorization') ?? '');
  if (!token) return { geminiApiKey: '', commentPrompt: DEFAULT_COMMENT_PROMPT };

  const user = await loadAuthUser(token);
  const value = await loadUserSetting(user.id, COMMENT_SETTINGS_KEY);
  return normalizeCommentSettings(value);
}

async function loadAuthUser(token: string): Promise<{ id: string }> {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.id) throw new Error('Invalid login session.');
  return { id: String(payload.id) };
}

async function loadUserSetting(userId: string, key: string) {
  const rows = await restFetch(
    `/rest/v1/app_settings?select=value&key=eq.${encodeURIComponent(`${key}:${userId}`)}&limit=1`,
  );
  return Array.isArray(rows) ? rows[0]?.value ?? null : null;
}

async function restFetch(path: string, init: RequestInit = {}) {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase REST failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

function normalizeCommentSettings(value: unknown): CommentSettings {
  const settings = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey.trim() : '',
    commentPrompt:
      typeof settings.commentPrompt === 'string' && settings.commentPrompt.trim()
        ? settings.commentPrompt.trim()
        : DEFAULT_COMMENT_PROMPT,
  };
}

function extractBearerToken(value: string) {
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? '';
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function extractVideoId(value = '') {
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

async function fetchYoutubeContext({
  videoId,
  eventInfo,
  mode,
  userSettings,
}: {
  videoId: string;
  eventInfo: Record<string, unknown>;
  mode: 'context' | 'candidates';
  userSettings: CommentSettings;
}) {
  if (!videoId) throw new Error('YouTube video ID was not found.');

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  if (mode === 'candidates') {
    const candidateContext = await fetchCandidateContext(videoId, watchUrl);
    let commentCandidates: Array<{ style: string; text: string }> = [];
    let commentCandidatesError = '';

    try {
      commentCandidates = await generateCommentCandidates({
        videoUrl: watchUrl,
        eventInfo: buildCandidateEventInfo(eventInfo, candidateContext),
        comments: candidateContext.comments,
        userSettings,
      });
    } catch (error) {
      commentCandidatesError = error instanceof Error ? error.message : 'Gemini comment generation failed.';
    }

    return {
      videoId,
      url: watchUrl,
      ...candidateContext.metadata,
      transcript: candidateContext.transcript,
      transcriptError: candidateContext.transcript ? '' : candidateContext.transcriptError,
      comments: candidateContext.comments,
      commentCandidates,
      commentCandidatesError,
    };
  }

  const watchResponse = await fetch(watchUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  const html = await watchResponse.text();
  if (!watchResponse.ok) {
    throw new Error(`Failed to open YouTube watch page. (${watchResponse.status})`);
  }

  const playerResponse = extractPlayerResponse(html);
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') || '';
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const apiVideoPromise = youtubeApiKey
    ? fetchYoutubeApiVideoSafe(videoId, youtubeApiKey)
    : Promise.resolve(null);
  const transcriptPromise = fetchTranscriptSafe(tracks);
  const apiCommentsPromise = youtubeApiKey
    ? fetchYoutubeApiCommentsSafe(videoId, youtubeApiKey)
    : Promise.resolve([]);
  const [apiVideo, transcript, apiComments] = await Promise.all([
    apiVideoPromise,
    transcriptPromise,
    apiCommentsPromise,
  ]);
  const metadata = {
    ...extractVideoMetadata(playerResponse, html, watchUrl),
    ...(apiVideo ? toApiVideoMetadata(apiVideo, watchUrl) : {}),
  };
  const comments = apiComments.length > 0 ? apiComments : await fetchCommentsSafe({ html, playerResponse, videoId });

  return {
    videoId,
    url: watchUrl,
    ...metadata,
    availableCaptionLanguages: tracks.map((track: Record<string, unknown>) => ({
      code: String(track.languageCode ?? ''),
      name: getText(track.name),
      isGenerated: track.kind === 'asr',
    })),
    transcript,
    transcriptError: transcript ? '' : 'No public YouTube transcript was found.',
    comments,
    commentCandidates: [],
    commentCandidatesError: '',
  };
}

async function fetchCandidateContext(videoId: string, watchUrl: string) {
  try {
    const watchResponse = await fetch(watchUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    const html = await watchResponse.text();
    if (!watchResponse.ok) throw new Error(`YouTube watch page failed: ${watchResponse.status}`);

    const playerResponse = extractPlayerResponse(html);
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') || '';
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const apiVideoPromise = youtubeApiKey
      ? fetchYoutubeApiVideoSafe(videoId, youtubeApiKey)
      : Promise.resolve(null);
    const transcriptPromise = fetchTranscriptSafe(tracks);
    const apiCommentsPromise = youtubeApiKey
      ? fetchYoutubeApiCommentsSafe(videoId, youtubeApiKey)
      : Promise.resolve([]);
    const [apiVideo, transcript, apiComments] = await Promise.all([
      apiVideoPromise,
      transcriptPromise,
      apiCommentsPromise,
    ]);
    const metadata = {
      ...extractVideoMetadata(playerResponse, html, watchUrl),
      ...(apiVideo ? toApiVideoMetadata(apiVideo, watchUrl) : {}),
    };
    const comments =
      apiComments.length > 0 ? apiComments : await fetchCommentsSafe({ html, playerResponse, videoId });

    return {
      metadata,
      transcript,
      transcriptError: transcript ? '' : 'No public YouTube transcript was found.',
      comments,
    };
  } catch (error) {
    return {
      metadata: {},
      transcript: null,
      transcriptError: error instanceof Error ? error.message : 'Failed to collect YouTube context.',
      comments: [],
    };
  }
}

function buildCandidateEventInfo(
  eventInfo: Record<string, unknown> = {},
  context: {
    metadata?: Record<string, unknown>;
    transcript?: { lines?: string[] } | null;
  } = {},
) {
  const transcriptLines = Array.isArray(context.transcript?.lines)
    ? context.transcript.lines.slice(0, 36)
    : [];
  const metadata = context.metadata ?? {};
  return {
    ...eventInfo,
    bodyLines: [
      ...(Array.isArray(eventInfo.bodyLines) ? eventInfo.bodyLines : []),
      metadata.title ? `YouTube title: ${metadata.title}` : '',
      metadata.channelName ? `Channel: ${metadata.channelName}` : '',
      metadata.description ? `Video description: ${String(metadata.description).slice(0, 900)}` : '',
      ...transcriptLines.map((line) => `Transcript: ${line}`),
    ].filter(Boolean),
  };
}

async function fetchYoutubeApiVideoSafe(videoId: string, apiKey: string) {
  try {
    const url = new URL(`${YOUTUBE_API_ENDPOINT}/videos`);
    url.searchParams.set('part', 'snippet,contentDetails,statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('hl', 'ko');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload.items) ? payload.items[0] ?? null : null;
  } catch {
    return null;
  }
}

async function fetchYoutubeApiCommentsSafe(videoId: string, apiKey: string) {
  try {
    const url = new URL(`${YOUTUBE_API_ENDPOINT}/commentThreads`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('maxResults', '30');
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('textFormat', 'plainText');
    url.searchParams.set('key', apiKey);
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items
      .map((item: Record<string, any>) => {
        const snippet = item.snippet?.topLevelComment?.snippet ?? {};
        const text = String(snippet.textDisplay ?? snippet.textOriginal ?? '').replace(/\s+/g, ' ').trim();
        if (!text) return null;
        return {
          author: String(snippet.authorDisplayName ?? ''),
          text,
          likes: Number(snippet.likeCount ?? 0),
          pinned: false,
          byUploader: Boolean(snippet.authorChannelId?.value && snippet.channelId === snippet.authorChannelId.value),
          publishedAt: String(snippet.publishedAt ?? ''),
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toApiVideoMetadata(item: Record<string, any>, watchUrl: string) {
  const snippet = item.snippet ?? {};
  const statistics = item.statistics ?? {};
  const contentDetails = item.contentDetails ?? {};
  const thumbnailUrl =
    snippet.thumbnails?.maxres?.url ||
    snippet.thumbnails?.standard?.url ||
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    '';
  return {
    title: snippet.title || '',
    channelName: snippet.channelTitle || '',
    channelId: snippet.channelId || '',
    channelUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : '',
    description: snippet.description || '',
    publishDate: snippet.publishedAt || '',
    lengthSeconds: parseIsoDurationSeconds(contentDetails.duration),
    viewCount: toNumberOrNull(statistics.viewCount),
    likeCount: toNumberOrNull(statistics.likeCount),
    commentCount: toNumberOrNull(statistics.commentCount),
    keywords: Array.isArray(snippet.tags) ? snippet.tags.slice(0, 20) : [],
    category: snippet.categoryId || '',
    thumbnailUrl,
    captionAvailable: contentDetails.caption === 'true',
    sourceApi: 'youtube-data-api',
    url: watchUrl,
  };
}

function parseIsoDurationSeconds(value: string) {
  const match = String(value ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function toNumberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchTranscriptSafe(tracks: Array<Record<string, any>>) {
  try {
    const track = chooseCaptionTrack(tracks);
    if (!track?.baseUrl) return null;
    const lines = await fetchCaptionLines(String(track.baseUrl));
    if (lines.length === 0) return null;
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

async function fetchCaptionLines(baseUrl: string) {
  for (const format of ['json3', 'vtt', 'xml']) {
    const url = new URL(baseUrl);
    if (format !== 'xml') url.searchParams.set('fmt', format);
    else url.searchParams.delete('fmt');
    try {
      const response = await fetch(url.toString());
      if (!response.ok) continue;
      const text = await response.text();
      const lines =
        format === 'json3'
          ? parseJson3CaptionLines(text)
          : format === 'vtt'
            ? parseVttCaptionLines(text)
            : parseXmlCaptionLines(text);
      if (lines.length > 0) return lines;
    } catch {
      // Try the next caption format.
    }
  }
  return [];
}

function parseJson3CaptionLines(text: string) {
  const payload = JSON.parse(text);
  return normalizeCaptionLines(
    (Array.isArray(payload.events) ? payload.events : []).map((event: Record<string, any>) =>
      (Array.isArray(event.segs) ? event.segs : [])
        .map((segment: Record<string, unknown>) => String(segment.utf8 ?? ''))
        .join(''),
    ),
  );
}

function parseVttCaptionLines(text: string) {
  return normalizeCaptionLines(
    text
      .split(/\r?\n/)
      .filter((line) => line && !/^WEBVTT|Kind:|Language:|\d+$|[\d:.]+\s+-->/i.test(line))
      .map((line) => line.replace(/<[^>]+>/g, '')),
  );
}

function parseXmlCaptionLines(text: string) {
  return normalizeCaptionLines(
    [...text.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((match) =>
      decodeHtml(match[1].replace(/<[^>]+>/g, '')),
    ),
  );
}

function normalizeCaptionLines(lines: string[]) {
  return lines
    .map((line) => decodeHtml(String(line)).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function chooseCaptionTrack(tracks: Array<Record<string, any>>) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  return (
    tracks.find((track) => String(track.languageCode ?? '').toLowerCase().startsWith('ko')) ??
    tracks.find((track) => /korean|\uD55C\uAD6D|\uD55C\uAE00/i.test(getText(track.name))) ??
    tracks.find((track) => String(track.languageCode ?? '').toLowerCase().startsWith('en')) ??
    tracks[0]
  );
}

function dedupeAdjacentLines(lines: string[]) {
  const result: string[] = [];
  for (const line of lines) {
    if (line && line !== result.at(-1)) result.push(line);
  }
  return result;
}

async function fetchCommentsSafe({
  html,
  playerResponse,
  videoId,
}: {
  html: string;
  playerResponse: Record<string, any>;
  videoId: string;
}) {
  try {
    const initialData = extractInitialData(html);
    const continuation = findFirstContinuation(initialData);
    const apiKey = getQuotedValue(html, 'INNERTUBE_API_KEY');
    if (!continuation || !apiKey) return [];
    const clientVersion =
      getQuotedValue(html, 'INNERTUBE_CLIENT_VERSION') ||
      playerResponse?.responseContext?.serviceTrackingParams
        ?.flatMap((item: Record<string, any>) => item.params ?? [])
        ?.find((param: Record<string, unknown>) => param.key === 'cver')?.value ||
      '2.20240501.00.00';
    const visitorData =
      getQuotedValue(html, 'VISITOR_DATA') ||
      playerResponse?.responseContext?.visitorData ||
      '';
    const response = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion,
            hl: 'ko',
            gl: 'KR',
            visitorData,
          },
        },
        videoId,
        continuation,
      }),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return extractCommentRenderers(payload).slice(0, 30);
  } catch {
    return [];
  }
}

function extractInitialData(html: string) {
  for (const marker of ['var ytInitialData = ', 'ytInitialData = ']) {
    const start = html.indexOf(marker);
    if (start >= 0) return JSON.parse(readBalancedJson(html, start + marker.length));
  }
  return null;
}

function findFirstContinuation(value: any): string {
  if (!value || typeof value !== 'object') return '';
  const token =
    value?.continuationEndpoint?.continuationCommand?.token ||
    value?.button?.buttonRenderer?.command?.continuationCommand?.token ||
    value?.continuationCommand?.token;
  if (typeof token === 'string' && token) return token;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstContinuation(item);
      if (found) return found;
    }
    return '';
  }
  for (const item of Object.values(value)) {
    const found = findFirstContinuation(item);
    if (found) return found;
  }
  return '';
}

function extractCommentRenderers(value: any) {
  const comments: Array<{ author: string; text: string; likes: number; pinned: boolean; byUploader: boolean }> = [];
  visit(value, (node) => {
    const renderer = node.commentRenderer;
    if (!renderer) return;
    const text = getText(renderer.contentText).replace(/\s+/g, ' ').trim();
    if (!text) return;
    comments.push({
      author: getText(renderer.authorText),
      text,
      likes: parseLikeCount(getText(renderer.voteCount)),
      pinned: Boolean(renderer.pinnedCommentBadge),
      byUploader: Boolean(renderer.authorIsChannelOwner),
    });
  });
  const seen = new Set<string>();
  return comments.filter((comment) => {
    const key = `${comment.author}\n${comment.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visit(value: any, callback: (node: any) => void) {
  if (!value || typeof value !== 'object') return;
  callback(value);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, callback);
    return;
  }
  for (const item of Object.values(value)) visit(item, callback);
}

function parseLikeCount(value: string) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const number = Number(match[1]);
  if (text.includes('\uB9CC') || /\bm\b/i.test(text)) return Math.round(number * 10000);
  if (text.includes('\uCC9C') || /\bk\b/i.test(text)) return Math.round(number * 1000);
  return Number.isFinite(number) ? number : 0;
}
function getQuotedValue(html: string, key: string) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  return decodeHtml(html.match(pattern)?.[1] ?? '');
}

async function generateCommentCandidates({
  videoUrl,
  eventInfo,
  comments = [],
  userSettings,
}: {
  videoUrl: string;
  eventInfo: Record<string, unknown>;
  comments?: Array<Record<string, unknown>>;
  userSettings: CommentSettings;
}) {
  const apiKey = userSettings.geminiApiKey || Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Supabase Function Secret GEMINI_API_KEY is not configured.');

  const parts: Array<Record<string, unknown>> = [
    { text: buildGeminiUserText(videoUrl, buildUserPrompt(eventInfo, comments, userSettings.commentPrompt)) },
  ];
  if (SHOULD_ATTACH_VIDEO_FILE) {
    parts.unshift({ fileData: { fileUri: videoUrl, mimeType: 'video/*' } });
  }

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      mediaResolution: 'MEDIA_RESOLUTION_LOW',
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                style: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['style', 'text'],
            },
          },
        },
        required: ['candidates'],
      },
    },
  };

  const rawText = await fetchGeminiWithFallback(apiKey, requestBody);

  const payload = JSON.parse(rawText);
  const text = payload?.candidates?.[0]?.content?.parts?.find((part: Record<string, unknown>) => part.text)?.text;
  if (!text) {
    const reason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini did not return a comment candidate. (${reason})`);
  }

  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  return list
    .filter((item: Record<string, unknown>) => typeof item.text === 'string' && item.text.trim())
    .slice(0, 1)
    .map((item: Record<string, unknown>) => ({
      style: String(item.style || '?? ??').trim(),
      text: sanitizeCommentText(String(item.text || '')),
    }));
}

async function fetchGeminiWithFallback(apiKey: string, requestBody: Record<string, unknown>) {
  const errors: string[] = [];
  for (const model of getGeminiModels()) {
    for (let attempt = 0; attempt < 1; attempt += 1) {
      let response: Response;
      let rawText = '';
      try {
        response = await fetch(buildGeminiEndpoint(model, apiKey), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        rawText = await response.text();
      } catch (error) {
        errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
        await sleep(backoffMs(attempt));
        continue;
      }

      if (response.ok) return rawText;

      errors.push(`${model}: ${response.status} ${rawText.slice(0, 180)}`);
      if (!RETRYABLE_GEMINI_STATUSES.has(response.status)) {
        throw new Error(`Gemini call failed (${response.status}): ${rawText.slice(0, 300)}`);
      }
      await sleep(backoffMs(attempt));
    }
  }

  throw new Error(`Gemini is temporarily busy. Please try again later. (${errors.at(-1) ?? 'unavailable'})`);
}

function getGeminiModels() {
  const configured = Deno.env.get('GEMINI_MODEL_FALLBACKS') || Deno.env.get('GEMINI_MODEL') || '';
  const models = configured
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
}

function buildGeminiEndpoint(model: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function backoffMs(attempt: number) {
  return attempt === 0 ? 700 : 1500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUserPrompt(
  eventInfo: Record<string, unknown>,
  comments: Array<Record<string, unknown>> = [],
  commentPrompt = DEFAULT_COMMENT_PROMPT,
) {
  const bodyLines = Array.isArray(eventInfo.bodyLines) ? eventInfo.bodyLines : [];
  const participationHints = Array.isArray(eventInfo.participationHints)
    ? eventInfo.participationHints
    : [];
  const commentLines = comments
    .slice(0, 10)
    .map((comment) => {
      const likes = Number(comment.likes ?? 0);
      const text = String(comment.text ?? '').replace(/\s+/g, ' ').trim();
      return text ? `  - ${likes > 0 ? `[likes ${likes}] ` : ''}${text}` : '';
    })
    .filter(Boolean);
  return [
    '[User comment style prompt]',
    commentPrompt || DEFAULT_COMMENT_PROMPT,
    '',
    'Create exactly one sincere Korean event comment candidate.',
    'Return JSON only. Put exactly one item in candidates. The item has style and text.',
    'Set style to a short Korean tone label. Write the text in Korean, long and polished enough to feel like a winning event comment.',
    'Use the supplied YouTube title, description, transcript excerpts, event text, and other participant comments only to understand context and mood.',
    'Do not include prize/giveaway product details in the comment text.',
    'Do not write evaluative review phrases about the video or post itself, such as saying the video was helpful, moving, detailed, or well made.',
    'Naturally satisfy the required participation condition when available: answer, expectation, support message, review, subscribe, like, or comment requirement.',
    'Make the comment unique, creative, positive, and lively, but not promotional or AI-like.',
    'Avoid generic praise. Include concrete context from the event topic or situation without inventing unseen facts.',
    'Treat supplied excerpts as the only source of facts. Do not infer products, scenes, tools, routines, or plot details from a title alone.',
    'Use other participant comments only as tone reference. Do not copy their wording, structure, or ideas.',
    'Do not say you want to win, are waiting for the announcement, or hope to receive the prize.',
    'Do not use emojis. Avoid quotation marks except when truly necessary.',
    'Do not use manipulative tags, personal data, false viewing claims, exaggerated advertising, or winning guarantees.',
    'Make it sound like a real person wrote it after thinking, not a template.',
    '',
    '[Event info]',
    `Title: ${eventInfo.title || '-'}`,
    `Platform: ${eventInfo.platform || '-'}`,
    `Deadline: ${eventInfo.deadline || '-'}`,
    `Announcement: ${eventInfo.announcement || '-'}`,
    `Prize: ${eventInfo.prize || '-'}`,
    `Participation hints: ${participationHints.join(', ') || '-'}`,
    bodyLines.length ? 'Event body excerpts:' : '',
    ...bodyLines.slice(0, 36).map((line) => `  ${line}`),
    '',
    commentLines.length ? '[Other participant comments for mood reference only, do not copy]' : '[Other participant comments] none or unavailable',
    ...commentLines,
    '',
    'Write one polished comment that can be copied after a quick human check.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function sanitizeCommentText(text: string) {
  return text
    .trim()
    .replace(/^[\s`'"]+|[\s`'"]+$/g, '')
    .trim();
}
function buildGeminiUserText(videoUrl: string, userPrompt: string) {
  if (!SHOULD_ATTACH_VIDEO_FILE) {
    return [
      userPrompt,
      '',
      'The raw video file is not attached for speed. Use the supplied YouTube title, description, transcript excerpts, comments, event body excerpts, and event conditions as factual source material.',
    ].join('\n');
  }

  return [
    userPrompt,
    '',
    '[Reference video URL]',
    videoUrl,
    '',
    'Use the attached video together with the event information to write one sincere Korean comment.',
  ].join('\n');
}

function extractVideoMetadata(playerResponse: Record<string, any>, html: string, watchUrl: string) {
  const details = playerResponse?.videoDetails ?? {};
  const microformat = playerResponse?.microformat?.playerMicroformatRenderer ?? {};
  const owner = microformat.ownerChannelName || details.author || '';
  const description = details.shortDescription || getText(microformat.description);

  return {
    title: details.title || getMetaContent(html, 'name="title"') || '',
    channelName: owner,
    channelUrl: microformat.ownerProfileUrl ? new URL(microformat.ownerProfileUrl, watchUrl).toString() : '',
    description,
    publishDate: microformat.publishDate || microformat.uploadDate || '',
    lengthSeconds: details.lengthSeconds ? Number(details.lengthSeconds) : null,
    viewCount: details.viewCount ? Number(details.viewCount) : null,
    keywords: Array.isArray(details.keywords) ? details.keywords.slice(0, 20) : [],
    category: microformat.category || '',
    thumbnailUrl: details.thumbnail?.thumbnails?.at(-1)?.url || '',
  };
}

function extractPlayerResponse(html: string) {
  const marker = 'ytInitialPlayerResponse = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('YouTube player response was not found.');

  const jsonStart = start + marker.length;
  return JSON.parse(readBalancedJson(html, jsonStart));
}

function readBalancedJson(text: string, start: number) {
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

  throw new Error('Failed to read YouTube player JSON.');
}

function getText(value: any) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.simpleText) return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run: Record<string, string>) => run.text).join('');
  return '';
}

function getMetaContent(html: string, selectorPart: string) {
  const pattern = new RegExp(`<meta[^>]*${selectorPart}[^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeHtml(html.match(pattern)?.[1] ?? '');
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'");
}

const SYSTEM_PROMPT = `You help draft Korean event comments.
Your role is limited to drafting comment candidates. Do not judge participation, search, enter events, or decide winners.
Create exactly one distinctive, sincere Korean comment candidate from the event information, supplied YouTube/post context, and other participant comments.
Use other participant comments only to understand mood. Do not copy their wording, structure, or ideas.
Do not mention giveaway prizes or prize products in the comment text.
Do not include evaluative review phrases about the video or post itself.
Write like a real person leaving a thoughtful, positive comment, not like an ad or AI explanation.
Avoid emojis, excessive quotation marks, personal data, winning guarantees, false viewing claims, manipulative tag/share phrases, and duplicated ideas.`;
