# 텔레그램 신규 이벤트 알림

크롤러(`crawl:full` / `crawl:suto`)가 Supabase에 이벤트를 저장할 때, **이번 크롤에서 처음 등장한 신규 이벤트**를 텔레그램으로 보내준다. 유튜브 댓글 이벤트는 Gemini로 추천 댓글까지 만들어 함께 보낸다.

> 토큰이 없으면 알림 단계는 **조용히 건너뛴다.** 즉 설정 안 해도 기존 크롤은 그대로 동작한다.

## 동작 요약

```
크롤 → Supabase upsert → 신규 이벤트만 추림
  → (클릭점수 하한 이상, 점수순, 1회 상한까지)
  → 유튜브 이벤트면 자막 추출 + Gemini로 추천 댓글 생성
  → 텔레그램으로 발송
```

비용: 텔레그램 발송은 무료, 댓글 생성은 Gemini **무료 등급**으로 충분(사용량 매우 적음).

## 1. 텔레그램 봇 만들기

1. 텔레그램에서 **@BotFather** 검색 → `/newbot` → 이름/사용자명 지정
2. 받은 **봇 토큰**을 `TELEGRAM_BOT_TOKEN` 으로 사용
3. 방금 만든 봇과 대화방을 열고 아무 메시지나 한 번 보낸다
4. 브라우저에서 아래 주소를 열어 `chat.id` 값을 확인 → `TELEGRAM_CHAT_ID`
   ```
   https://api.telegram.org/bot<봇토큰>/getUpdates
   ```
   응답 JSON의 `result[].message.chat.id` 가 그 값이다.

## 2. 환경변수

`.env` / `.env.local` (로컬) 또는 GitHub Actions Secrets(자동 크롤)에 설정한다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | BotFather 봇 토큰 |
| `TELEGRAM_CHAT_ID` | ✅ | 알림 받을 chat id |
| `GEMINI_API_KEY` | 선택 | 있으면 유튜브 이벤트 추천 댓글 생성(무료 등급 권장) |
| `YOUTUBE_API_KEY` | 선택 | 있으면 영상 메타/댓글 컨텍스트 보강 |
| `TELEGRAM_NOTIFY_MIN_SCORE` | 선택 | 알림 보낼 클릭점수 하한 (기본 60) |
| `TELEGRAM_MAX_NOTIFICATIONS_PER_RUN` | 선택 | 1회 실행당 최대 발송 개수 (기본 8) |

### GitHub Actions Secrets 등록
저장소 → Settings → Secrets and variables → Actions → New repository secret 로
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, (선택)`GEMINI_API_KEY`, `YOUTUBE_API_KEY` 추가.
`crawl-suto.yml` 워크플로가 자동으로 읽어 쓴다.

## 3. 연결 테스트

```bash
npm run telegram:test
```
텔레그램으로 "연결 테스트" 메시지가 오면 정상이다.

## 4. 스팸 방지

- 처음 도입한 직후 첫 크롤에서는 신규 이벤트가 많을 수 있으나, **클릭점수 하한 + 1회 상한(기본 8건)** 으로 제한된다.
- 더 적게/많이 받고 싶으면 `TELEGRAM_NOTIFY_MIN_SCORE`, `TELEGRAM_MAX_NOTIFICATIONS_PER_RUN` 을 조정한다.
- 신규 판별은 Supabase `events` 테이블에 이미 있던 `source_event_id` 인지로 한다. (JSON fallback 모드에서는 알림을 보내지 않는다.)
