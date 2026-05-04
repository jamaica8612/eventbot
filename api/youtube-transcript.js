import { extractVideoId, fetchYoutubeTranscript } from './youtubeTranscriptCore.js';

export default async function handler(request, response) {
  try {
    const requestUrl = new URL(request.url, 'http://localhost');
    const videoId = requestUrl.searchParams.get('videoId') || extractVideoId(requestUrl.searchParams.get('url'));
    const transcript = await fetchYoutubeTranscript({ videoId });
    response.status(200).json(transcript);
  } catch (error) {
    response.status(400).json({
      error: error.message || '유튜브 스크립트를 가져오지 못했습니다.',
    });
  }
}
