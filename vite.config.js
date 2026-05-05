import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { extractVideoId, fetchYoutubeContext } from './api/youtubeTranscriptCore.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    base: process.env.GITHUB_PAGES ? '/eventbot/' : '/',
    plugins: [react(), youtubeTranscriptApi()],
  };
});

function youtubeTranscriptApi() {
  return {
    name: 'youtube-transcript-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube-transcript', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '', 'http://localhost');
          const body = request.method === 'POST' ? await readJsonBody(request) : {};
          const videoId =
            body.videoId ||
            requestUrl.searchParams.get('videoId') ||
            extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
          const context = await fetchYoutubeContext({ videoId, eventInfo: body.eventInfo });
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(context));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(
            JSON.stringify({
              error: error.message || '유튜브 컨텍스트를 가져오지 못했습니다.',
            }),
          );
        }
      });
    },
  };
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
