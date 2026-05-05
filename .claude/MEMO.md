# Eventbot Handoff Memo

## Current Focus

The app is being tuned for mobile-first event participation and crawling reliability. Recent work focused on YouTube event context collection so the user can copy clean material into a separate GPT comment-generation bot.

## Latest Uploaded Commit

- `eeca44b Improve YouTube transcript buttons`

## What Changed Recently

- `scripts/youtube_transcript_api_fetch.py`
  - Uses `youtube-transcript-api`.
  - Transcript priority is now:
    1. Korean manual captions
    2. Korean/ko-orig auto captions
    3. Any Korean caption
    4. English manual captions
    5. English auto captions
    6. Any `ko*`
    7. Any `en*`
    8. First available transcript
  - Important: in the current environment, YouTube blocks transcript fetches with `IpBlocked`, even though caption listing can work.

- `api/youtubeTranscriptCore.js`
  - Flow is currently:
    1. Try `youtube-transcript-api` Python script.
    2. Fall back to YouTube timedtext.
    3. If requested with `audioFallback=1`, fall back to audio transcription through Whisper.
  - The audio fallback was tested and works locally.

- `scripts/youtube_audio_transcribe.py`
  - Downloads YouTube audio with `yt-dlp`.
  - Transcribes with `faster-whisper`.
  - This is the reliable path when captions are unavailable or blocked.

- `src/components/EventCards.jsx`
  - `GPT용 복사` now uses a clipboard fallback when `navigator.clipboard.writeText` fails.
  - `스크립트 가져오기` and `GPT용 복사` stop pointer/mouse/click bubbling so the expandable body card does not swallow/toggle the action.
  - `참여하기` links stop propagation too.

- `src/styles.css`
  - Added `position: relative` and `z-index: 1` for action links and YouTube buttons so mobile touch targets are not hidden under nearby layers.

## Verified

- `npm run build` passed.
- Direct `youtube-transcript-api` test on `WbaK-S2wzMc` returned `IpBlocked` in this environment.
- Full Node flow with `audioFallback: true` succeeded:
  - source: `audio-whisper`
  - lines: `80`
  - no transcript error
- Browser check showed `참여하기` links exist and have valid `href` values.

## Known Caveats

- The in-app browser page may need a reload after code changes.
- `GPT용 복사` only appears after YouTube context is loaded. If no YouTube link is detected for the event, there is no script/context button.
- YouTube caption endpoints can be IP-blocked. Do not assume `youtube-transcript-api` failure means the code is broken.
- Audio fallback is slower because it downloads audio and runs Whisper locally.

## Suggested Next Checks

1. In the browser, reload `http://localhost:5173/`.
2. Find an event whose body contains a YouTube link.
3. Expand the event body.
4. Click `스크립트 가져오기`.
5. Confirm it eventually shows YouTube context and transcript lines.
6. Click `GPT용 복사`.
7. Paste into a text box to confirm the copied material contains:
   - event title/platform/deadline/announcement/prize/link
   - YouTube title/channel/url/publish date/length/views/category/keywords
   - video description
   - event body
   - transcript or audio transcription

## User Preference

- Korean UI and Korean explanations.
- Mobile usability is the priority.
- The user often asks for changes to be uploaded after implementation.
- Keep event cards compact, touch-friendly, and consistent with the `집에서` card style.
