import { extractVideoId, fetchYoutubeContext } from './youtubeTranscriptCore.js';

// suto link.php 등 리다이렉트 URL을 따라가 최종 YouTube 영상 ID를 추출한다.
async function resolveYoutubeViaRedirect(rawUrl) {
  try {
    const response = await fetch(rawUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    const finalId = extractVideoId(response.url || '');
    if (finalId) return finalId;
    const html = await response.text().catch(() => '');
    const match = html.match(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^"'<>\s]*v=[A-Za-z0-9_-]{6,}|youtu\.be\/[A-Za-z0-9_-]{6,})/,
    );
    return match ? extractVideoId(match[0]) : '';
  } catch {
    return '';
  }
}

export default async function handler(request, response) {
  try {
    const body = request.method === 'POST' ? await readJsonBody(request) : {};
    const requestUrl = new URL(request.url, 'http://localhost');
    const inputUrl = body.url || requestUrl.searchParams.get('url') || '';
    let videoId =
      body.videoId ||
      requestUrl.searchParams.get('videoId') ||
      extractVideoId(inputUrl);
    // 영상 ID를 못 뽑으면 suto link.php 등 리다이렉트를 따라가 실제 YouTube URL을 해석한다.
    if (!videoId && inputUrl) {
      videoId = await resolveYoutubeViaRedirect(inputUrl);
    }
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
