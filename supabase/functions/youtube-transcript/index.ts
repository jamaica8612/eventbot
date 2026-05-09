const MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-eventbot-token',
};
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const passcodeSecret = Deno.env.get('EVENTBOT_PASSCODE');
  if (!passcodeSecret) {
    return json({ error: '비밀번호 secret이 설정되지 않았습니다.' }, 500);
  }

  const token = request.headers.get('x-eventbot-token') ?? '';
  if (!(await verifyToken(token, passcodeSecret))) {
    return json({ error: '잠금 해제가 필요합니다.' }, 401);
  }

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const requestUrl = new URL(request.url);
    const videoId =
      body.videoId ||
      requestUrl.searchParams.get('videoId') ||
      extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
    const mode = body.mode === 'context' ? 'context' : 'candidates';
    const context = await fetchYoutubeContext({ videoId, eventInfo: body.eventInfo ?? {}, mode });
    return json(context);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '유튜브 컨텍스트를 가져오지 못했습니다.' },
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
}: {
  videoId: string;
  eventInfo: Record<string, unknown>;
  mode: 'context' | 'candidates';
}) {
  if (!videoId) throw new Error('유튜브 영상 ID를 찾지 못했습니다.');

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const watchResponse = await fetch(watchUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  const html = await watchResponse.text();
  if (!watchResponse.ok) {
    throw new Error(`유튜브 영상 페이지를 열 수 없습니다. (${watchResponse.status})`);
  }

  const playerResponse = extractPlayerResponse(html);
  const metadata = extractVideoMetadata(playerResponse, html, watchUrl);
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const transcript = await fetchTranscriptSafe(tracks);
  const comments = await fetchCommentsSafe({ html, playerResponse, videoId });

  let commentCandidates: Array<{ style: string; text: string }> = [];
  let commentCandidatesError = '';
  if (mode === 'candidates') {
    try {
      commentCandidates = await generateCommentCandidates({ videoUrl: watchUrl, eventInfo });
    } catch (error) {
      commentCandidatesError = error instanceof Error ? error.message : 'Gemini 댓글 생성에 실패했습니다.';
    }
  }

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
    transcriptError: transcript ? '' : '사용 가능한 공개 자막을 찾지 못했습니다.',
    comments,
    commentCandidates,
    commentCandidatesError,
  };
}

async function fetchTranscriptSafe(tracks: Array<Record<string, any>>) {
  try {
    const track = chooseCaptionTrack(tracks);
    if (!track?.baseUrl) return null;
    const url = new URL(String(track.baseUrl));
    url.searchParams.set('fmt', 'json3');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const payload = await response.json();
    const lines = (Array.isArray(payload.events) ? payload.events : [])
      .map((event: Record<string, any>) =>
        (Array.isArray(event.segs) ? event.segs : [])
          .map((segment: Record<string, unknown>) => String(segment.utf8 ?? ''))
          .join(''),
      )
      .map((line: string) => line.replace(/\s+/g, ' ').trim())
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

function chooseCaptionTrack(tracks: Array<Record<string, any>>) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  return (
    tracks.find((track) => String(track.languageCode ?? '').toLowerCase().startsWith('ko')) ??
    tracks.find((track) => /korean|한국|한글/i.test(getText(track.name))) ??
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
  if (/만/.test(text)) return Math.round(number * 10000);
  if (/천/.test(text)) return Math.round(number * 1000);
  return Number.isFinite(number) ? number : 0;
}

function getQuotedValue(html: string, key: string) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  return decodeHtml(html.match(pattern)?.[1] ?? '');
}

async function generateCommentCandidates({
  videoUrl,
  eventInfo,
}: {
  videoUrl: string;
  eventInfo: Record<string, unknown>;
}) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Supabase Function Secret GEMINI_API_KEY가 설정되지 않았습니다.');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: videoUrl, mimeType: 'video/*' } },
            { text: buildUserPrompt(eventInfo) },
          ],
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
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini 호출 실패 (${response.status}): ${rawText.slice(0, 300)}`);
  }

  const payload = JSON.parse(rawText);
  const text = payload?.candidates?.[0]?.content?.parts?.find((part: Record<string, unknown>) => part.text)?.text;
  if (!text) {
    const reason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini가 댓글 후보를 반환하지 않았습니다. (${reason})`);
  }

  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  return list
    .filter((item: Record<string, unknown>) => typeof item.text === 'string' && item.text.trim())
    .map((item: Record<string, unknown>) => ({
      style: String(item.style || '').trim(),
      text: sanitizeCommentText(String(item.text || '')),
    }));
}

function buildUserPrompt(eventInfo: Record<string, unknown>) {
  const bodyLines = Array.isArray(eventInfo.bodyLines) ? eventInfo.bodyLines : [];
  const participationHints = Array.isArray(eventInfo.participationHints)
    ? eventInfo.participationHints
    : [];
  return [
    '서로 다른 목적의 이벤트 댓글 후보 3개를 만들어줘.',
    '반드시 JSON의 candidates 배열만 채워라. 각 후보는 style과 text를 가진다.',
    '후보 1: 짧고 자연스러운 댓글. 후보 2: 이벤트 조건을 충족하는 성의형 댓글. 후보 3: 영상 내용이 드러나는 개성형 댓글.',
    '영상 내용을 정확히 이해하고, 이벤트 참여 댓글처럼 자연스럽게 작성해줘.',
    '작은따옴표와 큰따옴표는 쓰지 말고, 실제 사람이 댓글창에 바로 남긴 것처럼 써줘.',
    '당첨 보장, 과장 광고, 허위 시청 경험, 개인정보, 친구 태그 조작 문구는 쓰지 마.',
    '각 댓글은 1~3문장, 35~140자 사이로 작성해줘.',
    '',
    '[이벤트 정보]',
    `제목: ${eventInfo.title || '-'}`,
    `플랫폼: ${eventInfo.platform || '-'}`,
    `마감: ${eventInfo.deadline || '-'}`,
    `발표: ${eventInfo.announcement || '-'}`,
    `경품: ${eventInfo.prize || '-'}`,
    `참여 힌트: ${participationHints.join(', ') || '-'}`,
    bodyLines.length ? '본문 발췌:' : '',
    ...bodyLines.slice(0, 24).map((line) => `  ${line}`),
    '',
    '[다른 참가자 댓글] 없음 또는 비활성화된 영상',
    '',
    'style 필드는 짧게 "짧은 자연형", "조건 충족형", "영상 공감형"처럼 한국어로 기입.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function sanitizeCommentText(text: string) {
  return text
    .trim()
    .replace(/^[`'"“”‘’「」『』]+/, '')
    .replace(/[`'"“”‘’「」『』]+$/, '')
    .trim();
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
  if (start < 0) throw new Error('유튜브 플레이어 정보를 찾지 못했습니다.');

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

  throw new Error('유튜브 플레이어 JSON을 끝까지 읽지 못했습니다.');
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

const SYSTEM_PROMPT = `너는 한국 이벤트 댓글 후보 작성을 돕는 어시스턴트다.
AI의 역할은 댓글 후보 생성으로만 제한된다. 이벤트 참여 여부 판단, 검색, 응모, 당첨 판정은 하지 않는다.
사용자가 제공한 이벤트 정보와 영상 내용을 바탕으로 자연스럽고 짧은 댓글 후보를 만든다.
과장 광고 문구처럼 쓰지 말고, 실제 사람이 영상 내용을 보고 남긴 댓글처럼 구체적으로 쓴다.
다른 사람 댓글을 베끼지 않고 새 문장으로 작성한다.
개인정보, 당첨 보장, 허위 시청 경험, 조작적 태그/공유 문구는 만들지 않는다.`;
