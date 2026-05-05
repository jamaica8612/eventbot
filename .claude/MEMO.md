# Eventbot Handoff Memo

## Current Focus

YouTube 처리 흐름이 **"외부 GPT 댓글봇용 자료 추출"에서 "Gemini가 댓글 후보 직접 생성"으로 전면 재구성**됨. 사용자는 이벤트 카드를 펼치고 `댓글 후보 만들기`를 누르기만 하면 Gemini가 바로 사용 가능한 댓글 후보 3개를 만들어줌. 외부 GPT봇은 더 이상 필수가 아니며, "전체 자료 복사" 버튼은 백업/수동 보정용으로만 남음.

## Latest Codex Follow-up

- 댓글 후보 생성 버튼은 이제 `유튜브 이벤트` 플랫폼에서만 표시한다. 본문에 유튜브 링크가 있어도 `홈페이지 이벤트` 등 다른 플랫폼이면 버튼을 숨긴다.
- 유튜브 스크립트 표시와 백업 transcript 호출을 제거했다. 댓글 후보 생성은 영상 URL + 영상 메타데이터 + 인기 댓글 + 이벤트 본문만 사용한다.
- Android 모바일에서 `참여하기`는 Samsung Internet 패키지(`com.sec.android.app.sbrowser`) intent URL로 열도록 처리했다. 실패하면 브라우저 fallback URL이 동작한다.
- 댓글 생성 프롬프트는 다른 사람 댓글을 배제하지 않고, 말투/길이/참여 방식/관심 포인트를 적극 참고하되 문장 복붙은 금지하는 방향으로 조정했다.
- 작은따옴표/큰따옴표/겹낫표로 댓글을 감싸는 것을 금지했고, 후보 텍스트 앞뒤 인용부호는 코드에서 한 번 더 제거한다.
- 권장 스타일에 `유머러스형`을 추가했다.

## New Flow

1. 사용자가 이벤트 카드 펼치기 → `댓글 후보 만들기` 버튼 클릭
2. 프론트가 `/api/youtube-transcript`에 **POST**로 영상 URL + 이벤트 정보(title/platform/deadline/prize/bodyLines) 전송
3. 백엔드(`api/youtubeTranscriptCore.js`)가 병렬로 수행:
   - **댓글 50개 수집**: `scripts/youtube_comments_fetch.py` (yt-dlp `--write-comments`, 좋아요 정렬)
   - **백업 transcript**: `scripts/youtube_transcript_api_fetch.py` (실패해도 무시)
4. **Gemini 호출** (`api/youtubeCommentGenerator.js`):
   - 영상 URL은 `fileData.fileUri`로 직접 전달 → Google 인프라가 페치 (본인 IP 무관)
   - 시스템 프롬프트: `prompts/comment_generator.md` 파일 (사용자 GPT 댓글봇 가이드 그대로)
   - 사용자 프롬프트: 이벤트 정보 + 좋아요순 댓글 50개 인라인
   - `responseSchema`로 구조화된 JSON 강제 (`{ candidates: [{ style, text }, ...] }`)
   - `mediaResolution: MEDIA_RESOLUTION_LOW`로 토큰 절감
5. UI에 댓글 후보 3개를 카드 형태로 표시. 각 후보별 `이 댓글 복사` 버튼.
6. `전체 자료 복사`는 기존 GPT봇 사용자가 외부 봇에 직접 붙여넣을 때만 사용 (백업).

## Latest Uploaded Commit

- `eeca44b Improve YouTube transcript buttons` (이전 작업, 현재 변경분은 아직 미업로드)

## Files Touched in This Reorg

### 신규
- `prompts/comment_generator.md` — Gemini 시스템 프롬프트. 댓글 작성 원칙/금지 표현/권장 스타일/출력 방식.
- `scripts/youtube_comments_fetch.py` — `python -m yt_dlp --write-comments --dump-single-json`으로 좋아요순 50개 추출.
- `api/youtubeCommentGenerator.js` — Gemini 2.5 Flash REST 호출. fetch 직접 사용(SDK 없음). `GEMINI_API_KEY` 필수.

### 수정
- `api/youtubeTranscriptCore.js` — timedtext/Whisper 폴백 코드 모두 제거. `audioFallback` 파라미터 제거. `eventInfo` 파라미터 추가. 댓글 추출 + 백업 transcript는 `Promise.all`로 병렬. Gemini 댓글 생성 단계 추가. 응답 객체에 `comments`, `commentCandidates`, `commentCandidatesError` 추가.
- `api/youtube-transcript.js` — POST 본문(`{ url, eventInfo }`) 파싱 추가. GET도 호환 유지.
- `vite.config.js` — `loadEnv`로 `.env.local`을 `process.env`에 머지(미들웨어가 `GEMINI_API_KEY` 읽도록). 미들웨어도 POST 본문 파싱 지원.
- `src/components/EventCards.jsx` — fetch POST로 변경, 라벨 `댓글 후보 만들기`/`댓글 후보 생성 중`, 댓글 후보 3개 카드 UI + 후보별 복사 버튼, "GPT용 복사" → "전체 자료 복사".
- `src/styles.css` — `.comment-candidates`, `.comment-candidate*` 스타일 추가.
- `.env.example` — `GEMINI_API_KEY` 키 안내 추가.

### 더 이상 사용하지 않음 (파일은 남겨둠)
- `scripts/youtube_audio_transcribe.py` — Whisper 오디오 폴백. 코드 경로에서 호출 제거. 향후 필요 시 복원 가능.

## What's Verified

- `npm run build` 성공
- Python 스크립트/Gemini 호출은 **브라우저/E2E 검증 미완** — `GEMINI_API_KEY`를 사용자가 `.env.local`에 설정한 뒤 dev 서버에서 `댓글 후보 만들기` 클릭으로 검증 필요.

## Open Items / What's NOT Done

1. **브라우저 E2E 검증** — Claude가 plan 모드에서는 GEMINI_API_KEY를 본인 환경에 설정할 수 없으므로 실제 댓글 생성이 동작하는지는 사용자가 키 채운 뒤 직접 확인해야 함.
2. **`scripts/youtube_audio_transcribe.py`의 정리 여부** — 현재는 호출 안 됨. 완전히 지울지, 두고 향후 옵션으로 둘지 결정 보류.
3. **댓글 후보 UI 다듬기** — 다크모드 색감, 모바일 좁은 화면에서의 줄바꿈 등은 실기기 확인 후 조정.
4. **Rate limit 핸들링** — Gemini 무료 티어 RPM 초과 시 사용자 친화 에러 메시지 미구현. 현재는 "Gemini 호출 실패 (429)" 식으로 표시됨.

## Required Setup (사용자가 한 번 해야 함)

1. https://aistudio.google.com/apikey 에서 Gemini API 키 발급
2. `eventbot/.env.local`에 추가:
   ```
   GEMINI_API_KEY=발급받은_키
   ```
3. dev 서버 재시작 (`npm run dev`)

## Known Caveats

- **공개 영상만 처리 가능** — 비공개/멤버십 영상은 Gemini가 페치 못함.
- **댓글 비활성화된 영상**도 Gemini가 영상만으로 후보 생성하지만, "다른 참가자 분위기 반영"은 약해짐.
- **Gemini 응답 시간** 약 30~60초 (영상 길이에 비례). UI는 `댓글 후보 생성 중` 표시.
- yt-dlp는 댓글 50개 가져올 때 30초~1분 더 걸릴 수 있음 (영상 인기도에 따라).

## Codex Handoff Prompt (작업 미완 시)

만약 Claude가 토큰 한계로 작업을 끝내지 못하면, 아래 프롬프트를 그대로 Codex(또는 다른 에이전트)에 던져서 이어받게 하면 됨:

---

> **Eventbot YouTube 댓글 후보 생성 기능 마무리 작업**
>
> 컨텍스트: `C:\work\eventbot`. Claude가 YouTube 처리 흐름을 "Gemini가 댓글 후보 3개를 직접 생성"하도록 재구성하던 중. 자세한 내용은 `.claude/MEMO.md`의 "New Flow" 섹션 참고.
>
> 현재 상태:
> - 모든 코드 변경 완료 (신규 파일 3개 + 수정 파일 6개, 목록은 MEMO.md)
> - `npm run build` 통과
> - **브라우저 E2E 검증은 GEMINI_API_KEY가 필요해서 미완**
>
> 해야 할 일:
> 1. `.env.local`에 `GEMINI_API_KEY=...` 설정됐는지 확인. 없으면 사용자에게 https://aistudio.google.com/apikey 에서 발급해서 채우라고 안내.
> 2. `npm run dev`로 dev 서버 띄우고 `http://localhost:5173/` 접속.
> 3. YouTube 링크가 본문에 있는 이벤트 카드 펼치기 → `댓글 후보 만들기` 클릭.
> 4. 30~60초 내 댓글 후보 3개가 카드로 표시되는지 확인:
>    - 영상 내용을 반영한 댓글인가
>    - `prompts/comment_generator.md`의 금지 표현("당첨되면 좋겠어요" 등)이 안 들어갔는가
>    - 각 후보 옆 `이 댓글 복사` 버튼 동작
> 5. 문제가 있으면:
>    - 콘솔/네트워크 탭에서 `/api/youtube-transcript` POST 응답의 `commentCandidates` / `commentCandidatesError` 확인
>    - Gemini 호출 본문은 `api/youtubeCommentGenerator.js`의 `requestBody` 참고
>    - 시스템 프롬프트 튜닝은 `prompts/comment_generator.md`만 수정하면 됨 (코드 재시작 필요)
> 6. 검증 끝나면 git add + commit. 커밋 메시지는 한국어로 "Add Gemini comment candidate generation" 같은 형식.
>
> 주의:
> - `scripts/youtube_audio_transcribe.py`는 더 이상 호출 안 되지만 파일은 남겨둠. 사용자가 명시적으로 지우라고 하기 전엔 건드리지 말 것.
> - 시스템 프롬프트 내용은 사용자가 직접 작성한 거라 어조나 규칙을 임의로 바꾸지 말 것.

---

## User Preference

- Korean UI and Korean explanations.
- Mobile usability is the priority.
- The user often asks for changes to be uploaded after implementation.
- Keep event cards compact, touch-friendly, and consistent with the `집에서` card style.
