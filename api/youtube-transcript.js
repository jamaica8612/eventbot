import { extractVideoId, fetchYoutubeContext } from './youtubeTranscriptCore.js';

export default async function handler(request, response) {
  try {
    const body = request.method === 'POST' ? await readJsonBody(request) : {};
    const requestUrl = new URL(request.url, 'http://localhost');
    const videoId =
      body.videoId ||
      requestUrl.searchParams.get('videoId') ||
      extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
    const context = await fetchYoutubeContext({
      videoId,
      eventInfo: body.eventInfo,
      mode: body.mode === 'context' ? 'context' : 'candidates',
    });
    response.status(200).json(context);
  } catch (error) {
    response.status(400).json({
      error: error.message || '유튜브 컨텍스트를 가져오지 못했습니다.',
    });
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf-8');
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`요청 본문 JSON 파싱 실패: ${error.message}`));
      }
    });
    request.on('error', reject);
  });
}
