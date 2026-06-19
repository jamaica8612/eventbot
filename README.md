# 당첨노트 (eventbot)

온라인 이벤트/경품 응모를 **자동으로 수집 → 저장 → 마감/발표 관리 → 응모**까지 도와주는 모바일 우선 반응형 PWA입니다.

슈퍼투데이·YouTube·핫딜 커뮤니티(클리앙·뽐뿌·에펨코리아)에서 이벤트를 모아오고, 마감일·발표일을 한 화면에서 관리하며, 응모를 돕습니다.

## 앱 방향

- 모바일과 PC가 같은 데이터/상태를 공유하는 하나의 반응형 웹앱입니다.
- 실제 UI/배포본은 `src/v2/`의 **"당첨노트" 디자인 시스템**입니다. 디자인 규칙은 `docs/DESIGN_RULES.md`를 따릅니다.
- 무료 또는 저비용으로 운영 가능한 구조(Supabase + GitHub Pages + GitHub Actions)를 선호합니다.

## 기술 스택

- **프런트엔드**: Vite + React 19 (JS/JSX), 모바일 우선 PWA(service worker + manifest)
- **백엔드**: Supabase (Postgres + Auth + Edge Functions). 클라이언트는 테이블에 직접 접근하지 않고 Edge Function 경유로만 접근합니다.
- **인증**: Supabase Auth + Google OAuth. 승인된(approved) 사용자만 앱에 진입하며, 관리자(is_admin)는 관리자 화면을 추가로 봅니다.
- **크롤러**: Node.js(슈퍼투데이·핫딜) + Python(curl_cffi 기반 소스). GitHub Actions로 주기 실행.
- **배포**: GitHub Pages (`deploy-pages.yml`).

## 현재 범위 (구현된 것)

- **인증**: Google OAuth 로그인, 승인 대기/관리자 게이트 (`src/v2/features/auth`, `src/storage/supabaseAuthStorage.js`).
- **DB 저장**: Supabase 테이블에 이벤트/상태/필터/댓글 설정 저장. anon 직접 접근은 마이그레이션으로 차단하고 Edge Function(`eventbot-data`, `hotdeal-data`, `verify-passcode`, `youtube-transcript`, `eventbot-crawl-trigger`)으로만 접근.
- **다중 크롤러**:
  - 슈퍼투데이 인기 이벤트(`crawler/sutoCrawler.js`, 본문 보강 `crawler/sutoBrowserCrawler.js`, Python 소스 `crawler/sutoCurlCffiSource.py`).
  - 핫딜 커뮤니티(클리앙·뽐뿌·에펨코리아) (`crawler/hotdealCrawler.js`, `crawler/hotdeal/`).
  - 이벤트 판정 규칙·날짜 추출·발표일 추론 (`crawler/eventDecision/`).
- **AI 댓글 후보 생성**: YouTube 이벤트에 대해 자막을 기반으로 댓글 후보를 생성 (`api/youtubeCommentGenerator.js`, `api/youtubeTranscriptCore.js`, `prompts/comment_generator.md`, `youtube-transcript` Edge Function). API 키는 브라우저에 노출하지 않고 Edge Function Secret으로만 보관합니다.
- **이벤트 관리 화면**(`src/v2/`): 대기 / 마감순 / 임시저장 / 검색 / 응모함 / 핫딜, 그리고 관리자 화면.
- **마감/발표 관리**: 마감 임박·오늘 발표 등 주의 위계 기반 표시, 당첨/수령 상태(`prizeAmount`, `receiptStatus`) 관리.
- **오프라인/동기화**: 저장 실패 시 로컬 대기열에 넣고 재시도, service worker 캐싱, 앱 설치 안내.

## 아직 하지 않는 것 / 비범위

- AI가 대신 응모하거나 결과를 자동 확정하는 흐름 (AI는 댓글 후보 생성에만 한정).
- 모바일 앱과 PC 앱의 분리 개발 (하나의 반응형 웹앱 유지).
- 크롤러가 Cloudflare 등 보호 화면을 우회하는 동작 (공개 AJAX/HTML만 사용).
- 복잡한 일반 사용자용 관리자 기능 (운영 최소 기능만).

## 아키텍처 개요

- **`src/v2/`** — 실제 배포되는 "당첨노트" 화면. 진입점은 `src/main.jsx` → `src/v2/AppV2.jsx`.
  - `features/`: auth, events, inbox, hotdeals, filter, admin 화면.
  - `lib/adapter.js`: v2 화면과 레거시 도메인 모델을 잇는 어댑터(`toEv`/`actList`/`actInbox`/`dispatchUpdate`).
  - `lib/domain.js`: 라벨/tone/표시 포맷 헬퍼.
  - `styles/tokens.css`: 색/타이포 토큰의 단일 소스(라이트/다크).
- **`src/` (레거시)** — `src/v2`가 재사용하는 검증된 도메인/동기화/저장 레이어.
  - `hooks/` (`useEvents`, `useEventActions`), `utils/` (`eventModel`, `deadlineModel`, `format`), `storage/` (Supabase·localStorage 로드/저장).
  - 과거 루트 레벨 UI(`src/App.jsx`, `src/components/`)는 v2로 대체되었습니다.
- **`crawler/`** — 웹앱과 분리된 수집기. 결과는 Supabase에 upsert하거나(환경 변수 있을 때) `public/crawled-events.json`에 폴백 저장.
- **`supabase/`** — `functions/`(Edge Functions), `migrations/`(스키마/RLS), `schema.sql`.
- **`.github/workflows/`** — `crawl-suto.yml`, `crawl-hotdeal.yml`, `build.yml`, `deploy-pages.yml`.

## 실행 방법

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

크롤러/유틸 스크립트 (`package.json`의 `scripts`):

```bash
npm run crawl:suto           # 슈퍼투데이 인기 이벤트 수집
npm run crawl:suto:youtube   # 슈퍼투데이 + 유튜브 자막 1건 수집
npm run crawl:suto:body      # 슈퍼투데이 상세 본문 보강
npm run crawl:hotdeal        # 핫딜 커뮤니티(클리앙·뽐뿌·에펨코리아) 수집
npm run crawl:full           # 목록 → 본문 보강 → Supabase 검증 일괄 실행
npm run backfill:announcement # 발표일 백필
npm run verify:supabase      # Supabase 연결/이벤트 수 검증
```

PowerShell에서 `npm` 실행 정책 오류가 나면 `npm.cmd`로 실행합니다.

```bash
npm.cmd install
npm.cmd run dev
```

> 환경 변수: Supabase 연결(`VITE_SUPABASE_URL` 등)이 설정돼 있으면 크롤러는 DB에 upsert하고 웹앱은 DB 이벤트를 우선 읽습니다. 미설정 시 `public/crawled-events.json`과 localStorage로 폴백 동작합니다. 시크릿(Gemini 키, 텔레그램 토큰 등)은 Edge Function Secret으로만 보관하고 브라우저에 노출하지 않습니다.

## 이어받기 (읽을 순서)

1. `README.md`
2. `CLAUDE.md` — 작업 규칙
3. `docs/DESIGN_RULES.md` — 디자인 규칙(UI 작업 시 최우선)
4. `docs/HANDOFF.md`
5. `docs/DECISIONS.md`
6. `docs/TODO.md`
7. `docs/EVENT_SCHEMA.md`, `docs/SUPABASE_PLAN.md`, `docs/HOTDEAL_PLAN.md`
8. `docs/CRAWLING_SCHEDULE.md`, `docs/DEPLOYMENT.md`
