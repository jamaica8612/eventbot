import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

export async function generateCommentCandidates({ videoUrl, eventInfo = {}, comments = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  if (!videoUrl) {
    throw new Error('영상 URL이 없습니다.');
  }

  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(eventInfo, comments);

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: videoUrl, mimeType: 'video/*' } },
          { text: userPrompt },
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
  };

  const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

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
      text: item.text.trim(),
    }));
}

function buildUserPrompt(eventInfo, comments) {
  const lines = [];
  lines.push('서로 다른 스타일로 이벤트 댓글 후보 3개를 만들어줘.');
  lines.push('영상은 위에 첨부됨. 영상 내용을 정확히 이해하고, 다른 참가자 댓글의 분위기는 참고만 하되 표현/문장은 따라하지 말 것.');
  lines.push('');
  lines.push('[이벤트 정보]');
  lines.push(`제목: ${eventInfo.title || '-'}`);
  lines.push(`플랫폼: ${eventInfo.platform || '-'}`);
  lines.push(`마감: ${eventInfo.deadline || '-'}`);
  lines.push(`경품: ${eventInfo.prize || '-'}`);
  if (Array.isArray(eventInfo.bodyLines) && eventInfo.bodyLines.length) {
    lines.push('본문 발췌:');
    for (const line of eventInfo.bodyLines.slice(0, 16)) {
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
  lines.push('각 후보는 권장 스타일 중 서로 다른 것으로 선택하고, style 필드에 그 스타일 이름을 한국어로 기입.');
  return lines.join('\n');
}
