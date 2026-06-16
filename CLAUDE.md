# eventbot 작업 규칙

이벤트 응모/관리 웹앱(당첨노트). Vite + React(JS/JSX) + Supabase + Python 크롤러 + GitHub Pages.
UI는 `src/v2/`의 "당첨노트" 디자인 시스템으로 구축돼 있고, 이게 실제 배포본이다.

## 디자인은 반드시 `docs/DESIGN_RULES.md`를 지킨다 (최우선)

UI를 수정·추가할 때는 **작업 전에 `docs/DESIGN_RULES.md`를 읽고 그 규칙 안에서만** 작업한다. 핵심:

- **색은 토큰만 쓴다.** 컴포넌트 코드에 hex 리터럴 금지. 전부 `var(--*)`.
  - 토큰 정의는 `src/v2/styles/tokens.css`의 `:root`(라이트) / `[data-theme="dark"]`. 여기가 **단일 소스**.
  - 컬러 배경 위 고정 흰 텍스트는 `var(--on-color)`. 브랜드 로고(구글) hex만 예외.
  - 검증: `grep -nE '#[0-9a-fA-F]{3,6}' src/v2`(tokens.css·icons.jsx 제외) = 0.
- **의미색 규칙**: `--accent`(주요 액션/활성), `--warn`(오늘 발표/미수령/임박), `--urgent`(지남/오늘 마감), `--win`(당첨/완료), `--lose`(미당첨/중립), `--info`(동기화/예정). 플랫폼색 `--yt/--naver/--home`.
- **주의 위계가 앱 정체성**이다(DESIGN_RULES §7): 시급(urgent) > 주의(warn) > 평시. 이걸 해치지 않는다.
- 숫자 `tabular-nums`(`.tnum`), 한글 `word-break: keep-all` + 긴 URL `overflow-wrap: anywhere`.
- 새 요소는 **기존 프리미티브로** 만든다(`src/v2/components/primitives.jsx`: Badge/Chip/Btn/IconBtn/SegToggle/Switch/Avatar/Overlay/Empty/Spinner). 새로 발명하지 않는다.
- 반응형 분기 900px. 모바일 터치 타깃 ≥44px, 본문 ≥14px.
- 매 변경 후 `DESIGN_RULES.md §12 체크리스트`를 통과시킨다.

## 아키텍처 규칙

- **데이터/인증 레이어는 신중히 다룬다**: `src/storage/**`, `src/hooks/**`, `src/utils/**`는 검증된 도메인/동기화 로직이다. UI 작업 중에는 건드리지 않는다(읽기·재사용만). 변경이 필요하면 의도를 명확히 하고 별도로 다룬다.
- **어댑터 경유**: v2 화면은 `update*` 핸들러를 직접 호출하지 않는다. `src/v2/lib/adapter.js`의 `toEv`/`actList`/`actInbox`/`dispatchUpdate`만 쓴다.
- **도메인 표시값**은 `src/v2/lib/domain.js`(deadlineMeta/announceMeta/won/wonShort/parseAmount/platformMeta). 계산·정렬·판정은 현재 모델(eventModel/deadlineModel/format) 재사용.
- **백엔드 접근은 Edge Function 경유**. 클라이언트는 Supabase 테이블 직접 접근 금지(anon 차단). `supabase/functions/`(eventbot-data, youtube-transcript, verify-passcode, eventbot-crawl-trigger). Edge Function 수정 시 `supabase functions deploy <name>` 필요.
- **시크릿은 Edge Function Secret**으로만(Gemini 키, 텔레그램 토큰 등). 브라우저에 노출 금지.

## 검증

- `npm run build` 통과.
- 디자인 변경은 **실제 로그인 화면에서 라이트/다크/모바일 육안 확인**. `npm run build` 통과 ≠ 동작/디자인 정상(Vite는 미정의 CSS var·런타임 에러를 못 잡는다).
- 데이터 흐름 변경은 실 Supabase에서 회귀(저장→새로고침 유지).

## 도메인 메모

- 슈퍼투데이(suto) 유튜브 이벤트의 `url`/`applyUrl`/`originalUrl`은 전부 suto 링크다. 실제 영상 URL은 `raw.externalLinks`에만 있고, 없으면 백엔드가 `applyUrl`(link.php) 리다이렉트를 따라가 해석한다(`youtube-transcript` Edge Function `resolveYoutubeViaRedirect`).
