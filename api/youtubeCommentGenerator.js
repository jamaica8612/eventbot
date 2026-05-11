import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SHOULD_ATTACH_VIDEO_FILE = process.env.GEMINI_ATTACH_VIDEO_FILE === '1';

const PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'prompts',
  'comment_generator.md',
);

let cachedSystemPrompt = '';

function loadSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = readFileSync(PROMPT_PATH, 'utf-8');
  }
  return cachedSystemPrompt;
}

export async function generateCommentCandidates({
  videoUrl,
  eventInfo = {},
  comments = [],
  timeoutMs = 80000,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  if (!videoUrl) {
    throw new Error('영상 URL이 없습니다.');
  }

  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(eventInfo, comments);
  const parts = [{ text: buildGeminiUserText(videoUrl, userPrompt) }];
  if (SHOULD_ATTACH_VIDEO_FILE) {
    parts.unshift({ fileData: { fileUri: videoUrl, mimeType: 'video/*' } });
  }

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
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

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Gemini 응답 시간이 너무 오래 걸렸습니다.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini 호출 실패 (${response.status}): ${rawText.slice(0, 300)}`);
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini 응답을 파싱하지 못했습니다.');
  }

  const text = payload?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) {
    const blockReason =
      payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini가 댓글 후보를 반환하지 않았습니다. (${blockReason})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini 댓글 응답 JSON 파싱에 실패했습니다.');
  }

  const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  return list
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .map((item) => ({
      style: String(item.style || '').trim(),
      text: sanitizeCommentText(item.text),
    }));
}

function buildGeminiUserText(videoUrl, userPrompt) {
  return [
    userPrompt,
    '',
    '[참고 영상 URL]',
    videoUrl,
    '',
    SHOULD_ATTACH_VIDEO_FILE
      ? '첨부된 영상과 위 이벤트 정보를 함께 참고해 댓글 후보를 작성해줘.'
      : '영상 파일은 속도를 위해 첨부하지 않았다. 위 이벤트 본문과 조건을 기준으로 댓글 후보를 작성하고, 영상 내용은 본문에 드러난 범위 안에서만 구체화해줘.',
  ].join('\n');
}

function sanitizeCommentText(text) {
  return String(text)
    .trim()
    .replace(/^[`'"“”‘’「」『』]+/, '')
    .replace(/[`'"“”‘’「」『』]+$/, '')
    .trim();
}

function buildUserPrompt(eventInfo, comments) {
  const lines = [];
  const participationHints = Array.isArray(eventInfo.participationHints)
    ? eventInfo.participationHints
    : [];
  lines.push('서로 다른 목적의 이벤트 댓글 후보 3개를 만들어줘.');
  lines.push('반드시 JSON의 candidates 배열만 채워라. 각 후보는 style과 text를 가진다.');
  lines.push('후보 1: 짧고 자연스러운 댓글. 후보 2: 이벤트 조건을 충족하는 성의형 댓글. 후보 3: 영상 내용이 드러나는 개성형 댓글.');
  lines.push('영상은 위에 첨부됨. 영상 내용을 정확히 이해하고, 다른 참가자 댓글의 말투, 길이, 참여 방식, 관심 포인트를 참고할 것.');
  lines.push('다만 다른 참가자의 문장을 그대로 베끼거나 몇 단어만 바꾼 듯한 문장은 만들지 말 것.');
  lines.push('작은따옴표와 큰따옴표는 쓰지 말고, 실제 사람이 댓글창에 바로 남긴 것처럼 자연스럽게 써줘.');
  lines.push('당첨 보장, 과장 광고, 허위 시청 경험, 개인정보, 친구 태그 조작 문구는 쓰지 마.');
  lines.push('각 댓글은 1~3문장, 35~140자 사이로 작성해줘.');
  lines.push('');
  lines.push('[이벤트 정보]');
  lines.push(`제목: ${eventInfo.title || '-'}`);
  lines.push(`플랫폼: ${eventInfo.platform || '-'}`);
  lines.push(`마감: ${eventInfo.deadline || '-'}`);
  lines.push(`발표: ${eventInfo.announcement || '-'}`);
  lines.push(`경품: ${eventInfo.prize || '-'}`);
  lines.push(`참여 힌트: ${participationHints.join(', ') || '-'}`);
  if (Array.isArray(eventInfo.bodyLines) && eventInfo.bodyLines.length) {
    lines.push('본문 발췌:');
    for (const line of eventInfo.bodyLines.slice(0, 24)) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('');

  if (comments.length === 0) {
    lines.push('[다른 참가자 댓글] 없음 또는 비활성화된 영상');
  } else {
    lines.push(`[다른 참가자 댓글 (좋아요순 ${comments.length}개)]`);
    for (const comment of comments) {
      const author = comment.author || '익명';
      const likes = comment.likes ?? 0;
      const text = String(comment.text).replace(/\s+/g, ' ').trim().slice(0, 240);
      lines.push(`- ${author} (좋아요 ${likes}): ${text}`);
    }
  }

  lines.push('');
  lines.push('style 필드는 짧게 "짧은 자연형", "조건 충족형", "영상 공감형"처럼 한국어로 기입.');
  return lines.join('\n');
}
