import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { extractVideoId, fetchYoutubeContext } from './api/youtubeTranscriptCore.js';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/eventbot/' : '/',
  plugins: [react(), youtubeTranscriptApi()],
});

function youtubeTranscriptApi() {
  return {
    name: 'youtube-transcript-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube-transcript', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '', 'http://localhost');
          const videoId =
            requestUrl.searchParams.get('videoId') ||
            extractVideoId(requestUrl.searchParams.get('url') ?? '');
          const audioFallback = requestUrl.searchParams.get('audioFallback') === '1';
          const transcript = await fetchYoutubeContext({ videoId, audioFallback });
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(transcript));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(
            JSON.stringify({
              error: error.message || '유튜브 스크립트를 가져오지 못했습니다.',
            }),
          );
        }
      });
    },
  };
}
