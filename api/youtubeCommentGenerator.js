import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const SHOULD_ATTACH_VIDEO_FILE = process.env.GEMINI_ATTACH_VIDEO_FILE === '1';
const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);

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

  const { rawText } = await fetchGeminiWithFallback({
    apiKey,
    requestBody,
    timeoutMs,
  });

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
    .slice(0, 1)
    .map((item) => ({
      style: String(item.style || '정성 댓글').trim(),
      text: sanitizeCommentText(item.text),
    }));
}

async function fetchGeminiWithFallback({ apiKey, requestBody, timeoutMs }) {
  const startedAt = Date.now();
  const models = getGeminiModels();
  const errors = [];

  for (const model of models) {
    for (let attempt = 0; attempt < 1; attempt += 1) {
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 1000) {
        throw new Error('Gemini 응답 시간이 너무 오래 걸렸습니다.');
      }

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), remainingMs);
      let response;
      let rawText = '';

      try {
        response = await fetch(buildGeminiEndpoint(model, apiKey), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify(requestBody),
        });
        rawText = await response.text();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Gemini 응답 시간이 너무 오래 걸렸습니다.');
        }
        errors.push(`${model}: ${error.message}`);
        await sleep(backoffMs(attempt));
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        return { rawText, model };
      }

      errors.push(`${model}: ${response.status} ${rawText.slice(0, 180)}`);
      if (!RETRYABLE_GEMINI_STATUSES.has(response.status)) {
        throw new Error(`Gemini 호출 실패 (${response.status}): ${rawText.slice(0, 300)}`);
      }
      await sleep(backoffMs(attempt));
    }
  }

  throw new Error(`Gemini가 일시적으로 혼잡합니다. 잠시 뒤 다시 시도해 주세요. (${errors.at(-1) ?? 'unavailable'})`);
}

function getGeminiModels() {
  const configured = process.env.GEMINI_MODEL_FALLBACKS || process.env.GEMINI_MODEL || '';
  const models = configured
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

function buildGeminiEndpoint(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function backoffMs(attempt) {
  return attempt === 0 ? 700 : 1500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGeminiUserText(videoUrl, userPrompt) {
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

function sanitizeCommentText(text) {
  return String(text)
    .trim()
    .replace(/^[\s`'"]+|[\s`'"]+$/g, '')
    .trim();
}
function buildUserPrompt(eventInfo, comments) {
  const lines = [];
  const participationHints = Array.isArray(eventInfo.participationHints)
    ? eventInfo.participationHints
    : [];

  lines.push('Create exactly one sincere Korean event comment candidate.');
  lines.push('Return JSON only. Put exactly one item in candidates. The item has style and text.');
  lines.push('Set style to a short Korean tone label. Write the text in Korean, long and polished enough to feel like a winning event comment.');
  lines.push('Use the supplied YouTube title, description, transcript excerpts, event text, and other participant comments only to understand context and mood.');
  lines.push('Do not include prize/giveaway product details in the comment text.');
  lines.push('Do not write evaluative review phrases about the video or post itself, such as saying the video was helpful, moving, detailed, or well made.');
  lines.push('Naturally satisfy the required participation condition when available: answer, expectation, support message, review, subscribe, like, or comment requirement.');
  lines.push('Make the comment unique, creative, positive, and lively, but not promotional or AI-like.');
  lines.push('Avoid generic praise. Include concrete context from the event topic or situation without inventing unseen facts.');
  lines.push('Treat supplied excerpts as the only source of facts. Do not infer products, scenes, tools, routines, or plot details from a title alone.');
  lines.push('Use other participant comments only as tone reference. Do not copy their wording, structure, or ideas.');
  lines.push('Do not say you want to win, are waiting for the announcement, or hope to receive the prize.');
  lines.push('Do not use emojis. Avoid quotation marks except when truly necessary.');
  lines.push('Do not use manipulative tags, personal data, false viewing claims, exaggerated advertising, or winning guarantees.');
  lines.push('Make it sound like a real person wrote it after thinking, not a template.');
  lines.push('');
  lines.push('[Event info]');
  lines.push(`Title: ${eventInfo.title || '-'}`);
  lines.push(`Platform: ${eventInfo.platform || '-'}`);
  lines.push(`Deadline: ${eventInfo.deadline || '-'}`);
  lines.push(`Announcement: ${eventInfo.announcement || '-'}`);
  lines.push(`Prize: ${eventInfo.prize || '-'}`);
  lines.push(`Participation hints: ${participationHints.join(', ') || '-'}`);
  if (Array.isArray(eventInfo.bodyLines) && eventInfo.bodyLines.length) {
    lines.push('Event body excerpts:');
    for (const line of eventInfo.bodyLines.slice(0, 36)) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('');

  if (comments.length === 0) {
    lines.push('[Other participant comments] none or unavailable');
  } else {
    lines.push(`[Other participant comments for mood reference only, do not copy; count ${comments.length}]`);
    for (const comment of comments.slice(0, 10)) {
      const author = comment.author || 'anonymous';
      const likes = comment.likes ?? 0;
      const commentText = String(comment.text).replace(/\s+/g, ' ').trim().slice(0, 240);
      lines.push(`- ${author} (likes ${likes}): ${commentText}`);
    }
  }

  lines.push('');
  lines.push('Write one polished comment that can be copied after a quick human check.');
  return lines.join('\n');
}
