import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
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
    plugins: [react(), localApi()],
  };
});

function localApi() {
  let crawlPromise = null;

  return {
    name: 'eventbot-local-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube-transcript', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '', 'http://localhost');
          const body = request.method === 'POST' ? await readJsonBody(request) : {};
          const videoId =
            body.videoId ||
            requestUrl.searchParams.get('videoId') ||
            extractVideoId(body.url || requestUrl.searchParams.get('url') || '');
          const context = await fetchYoutubeContext({
            videoId,
            eventInfo: body.eventInfo,
            mode: body.mode === 'context' ? 'context' : 'candidates',
          });
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

      server.middlewares.use('/api/crawl-suto', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        try {
          if (!crawlPromise) {
            crawlPromise = runCrawler().finally(() => {
              crawlPromise = null;
            });
          }
          const result = await crawlPromise;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(result));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: error.message || 'Crawler failed.' }));
        }
      });
    },
  };
}

function runCrawler() {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, ['run', 'crawl:full'], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, stdout: stdout.slice(-4000), stderr: stderr.slice(-2000) });
      } else {
        reject(new Error((stderr || stdout || `Crawler exited with code ${code}`).slice(-4000)));
      }
    });
  });
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
