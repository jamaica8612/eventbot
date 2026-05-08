const MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const requestUrl = new URL(request.url);
    const videoId =
      body.videoId ||
      requestUrl.searchParams.get('videoId') ||
      extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
    const context = await fetchYoutubeContext({ videoId, eventInfo: body.eventInfo ?? {} });
    return json(context);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '유튜브 컨텍스트를 가져오지 못했습니다.' },
      400,
    );
  }
});

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

async function fetchYoutubeContext({ videoId, eventInfo }: { videoId: string; eventInfo: Record<string, unknown> }) {
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

  let commentCandidates: Array<{ style: string; text: string }> = [];
  let commentCandidatesError = '';
  try {
    commentCandidates = await generateCommentCandidates({ videoUrl: watchUrl, eventInfo });
  } catch (error) {
    commentCandidatesError = error instanceof Error ? error.message : 'Gemini 댓글 생성에 실패했습니다.';
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
    transcript: null,
    transcriptError: '',
    comments: [],
    commentCandidates,
    commentCandidatesError,
  };
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
  return [
    '서로 다른 스타일로 이벤트 댓글 후보 3개를 만들어줘.',
    '영상 내용을 정확히 이해하고, 이벤트 참여 댓글처럼 자연스럽게 작성해줘.',
    '작은따옴표와 큰따옴표는 쓰지 말고, 실제 사람이 댓글창에 바로 남긴 것처럼 써줘.',
    '후보 중 하나는 상황에 맞으면 유머러스형으로 만들어줘. 억지 농담은 피할 것.',
    '',
    '[이벤트 정보]',
    `제목: ${eventInfo.title || '-'}`,
    `플랫폼: ${eventInfo.platform || '-'}`,
    `마감: ${eventInfo.deadline || '-'}`,
    `경품: ${eventInfo.prize || '-'}`,
    bodyLines.length ? '본문 발췌:' : '',
    ...bodyLines.slice(0, 16).map((line) => `  ${line}`),
    '',
    '[다른 참가자 댓글] 없음 또는 비활성화된 영상',
    '',
    '각 후보는 권장 스타일 중 서로 다른 것으로 선택하고, style 필드에 그 스타일 이름을 한국어로 기입.',
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

const SYSTEM_PROMPT = `너는 한국 이벤트 댓글 작성을 돕는 어시스턴트다.
사용자가 제공한 이벤트 정보와 영상 내용을 바탕으로 자연스럽고 짧은 댓글 후보를 만든다.
과장 광고 문구처럼 쓰지 말고, 실제 사람이 영상 내용을 보고 남긴 댓글처럼 구체적으로 쓴다.
개인정보, 당첨 보장, 허위 시청 경험은 만들지 않는다.`;
