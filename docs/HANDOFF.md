# HANDOFF

## 프로젝트 목적

이벤트 딸각 웹앱은 밤에 택배 일을 하는 사용자가 업무 중 아주 짧은 시간에 이벤트를 확인하고 처리 여부를 판단할 수 있게 돕는 웹앱입니다.

핵심은 많은 이벤트 노출이 아니라 실제 생활 중 처리 가능한 흐름입니다.

현재 우선순위는 수동 입력보다 자동 수집입니다. 목표 흐름은 `크롤러 -> DB -> 웹앱 -> 모바일 딸각 관리`입니다.

## 사용자의 실제 상황

- 밤에 택배 일을 합니다.
- 업무 중에는 폰을 오래 볼 수 없습니다.
- 현장에서는 짧고 단순한 이벤트만 처리할 수 있습니다.
- 유튜브 댓글 이벤트, 정성 댓글 이벤트, 긴 설문은 집에서 처리하는 편이 현실적입니다.
- 모바일은 현장 딸각용입니다.
- PC는 집에서 정리하고 천천히 참여할 이벤트를 보는 용도입니다.
- 사용자는 프로그래밍 초보에 가까우므로 구조가 단순해야 합니다.
- 사용자는 디자인 품질도 중요하게 봅니다.
- 무료 또는 저비용 운영을 선호합니다.

## 현재까지 완료한 작업

- 빈 Git 저장소에서 Vite + React 프로젝트 뼈대를 만들었습니다.
- 모바일 우선 단일 화면을 만들었습니다.
- 목업 이벤트 데이터를 `src/data/events.js`로 분리했습니다.
- 이벤트 카드와 상태 변경 버튼을 만들었습니다.
- PC 화면에서 2열 목록으로 확장되는 반응형 레이아웃을 만들었습니다.
- `vite.config.js`를 추가해 React JSX 렌더링 문제를 해결했습니다.
- Wanted Design System을 참고한 밝은 제품 UI로 스타일을 전환했습니다.
- 폰트는 Pretendard로 지정했습니다.
- 이벤트 상태를 `localStorage`에 저장하도록 추가했습니다.
- 새 이벤트를 직접 추가하는 최소 입력 폼을 만들었습니다.
- 직접 추가한 이벤트도 `localStorage`에 저장하도록 추가했습니다.
- 이후 사용자의 목표가 자동 수집 중심으로 명확해져 직접 추가 기능은 제거했습니다.
- 슈퍼투데이 인기 이벤트 1차 크롤러를 만들었습니다.
- 크롤링 결과를 웹앱 목록에 자동으로 합치도록 연결했습니다.
- 크롤링 이벤트 카드에 원문 링크 열기 버튼을 붙였습니다.
- 슈퍼투데이 크롤러에서 인스타그램 이벤트를 제외했습니다.
- 슈퍼투데이 크롤러에서 출석/출첵/체크인 이벤트를 제외했습니다.
- 크롤링 결과에 원문 제목, 원문 링크, 플랫폼, 순위, 북마크 수를 저장하도록 했습니다.
- Supabase 1차 계획 문서와 SQL 테이블 초안을 만들었습니다.
- 크롤링 간격 정책을 `docs/CRAWLING_SCHEDULE.md`에 정리했습니다.
- 참여한 이벤트의 결과를 `결과 미확인`, `당첨`, `미당첨`으로 관리하도록 UI와 localStorage를 확장했습니다.
- 프로젝트 인계 문서를 만들었습니다.

## 다음 개발 우선순위

1. GitHub Actions로 crawler 자동 실행을 안정화합니다.
2. Supabase 저장/동기화를 확실히 고정합니다.
3. 저장 실패 재시도 기능을 추가합니다.
4. 필터 설정을 코드가 아니라 화면에서 조절하게 만듭니다.
5. 이벤트 상세 분석 품질을 개선합니다.
6. PWA 설치/알림 기능을 추가합니다.

## 2026-05-04 자동 개선 적용 사항

- App.jsx 1582줄 → 약 250줄 오케스트레이터로 축소. 컴포넌트/훅/유틸 9개 파일로 분리.
- UTF-8 깨진 문자열 비교 버그 수정 (`경품 정보 미수집` 비교).
- 미사용 `WinningRow` 컴포넌트 삭제.
- `ruleDecision.js`: `출석`/`출첵`/`매일 참여`/`데일리`를 negativeRules로 이동 (-50점).
- `sutoCrawler.js`: 지수 백오프 재시도 2회 + 모바일 UA 회전.
- `supabase/schema.sql`: 중복 `add column` 정리, RLS를 anon에 대해 컬럼 단위 grant로 제한.
- `normalizeContentLines`: O(n²) `indexOf` 중복 제거를 `Set` 기반 O(n)으로 교체.
- "지금" 카드: 액션 버튼 4개 → 큰 `참여하기` 1개 + 보조 3개로 재구성.
- `.github/workflows/crawl-suto.yml`: Supabase 미설정 시 JSON 자동 commit/push 단계 추가, `permissions: contents: write` 부여.

## 2026-05-08 자동 실행 안정화 적용 사항

- `scripts/crawlFull.js`: Supabase 환경 변수가 있으면 목록 upsert → 본문 보강 → Supabase 검증을 실행하고, 없으면 JSON fallback 저장만 실행하도록 분기했습니다.
- `scripts/crawlFull.js`: Windows 로컬 실행 안정성을 위해 `npm` 재호출 대신 Node 스크립트를 직접 실행합니다.
- `scripts/verifySupabase.js`: GitHub Actions 서버 검증에는 anon key가 필요 없으므로 `VITE_SUPABASE_ANON_KEY` 필수 조건을 제거했습니다.
- `scripts/verifySupabase.js`: 저장 확인 로그에 전체 이벤트 수와 최신 `last_seen_at`을 함께 출력합니다.
- 로컬 `npm.cmd run crawl:full` 확인 기준 80개 이벤트가 Supabase에 upsert됐고, 최신 `last_seen_at` 검증까지 통과했습니다.

## 2026-05-08 앱 운영 기능 적용 사항

- 상태/결과/당첨 저장이 Supabase에 실패하면 `event-click-sync-queue` localStorage 대기열에 보관하고, 온라인 복구 또는 10초 간격으로 자동 재시도합니다.
- 재시도 중/실패/복구 완료 상태를 상단 안내로 표시합니다.
- `필터설정` 패널에서 `지금` 점수 기준, `집에서` 점수 기준, 제외 키워드, 숨길 플랫폼을 조절할 수 있습니다.
- 필터 설정은 `event-click-filter-settings` localStorage에 저장합니다.
- 경품 추출 규칙에 배민/올리브영/문화상품권/모바일상품권/금액 패턴을 보강했고, 크롤러 품질 로그에 `prize` 추출률을 추가했습니다.
- `public/sw.js` 서비스 워커를 추가하고, 앱 설치 버튼과 알림 권한 요청 UI를 붙였습니다.

## 중요한 파일 위치

- `crawler/sutoCrawler.js`: 슈퍼투데이 이벤트 수집기 (재시도/UA 회전 포함)
- `crawler/supabaseEventRepository.js`: Supabase upsert 저장소
- `crawler/eventDecision/ruleDecision.js`: 규칙 기반 클릭 점수/액션 판단
- `public/crawled-events.json`: 크롤링 결과 JSON (Supabase 미설정 시 폴백)
- `src/App.jsx`: 라우팅·상태 오케스트레이터 (~250줄로 축소)
- `src/constants.js`: 상태 라벨, 필터 정의
- `src/utils/format.js`: 날짜·금액·시간 포매터
- `src/utils/eventModel.js`: enrich/filter/announcement/winning/content 순수 함수
- `src/components/EventCards.jsx`: 4종 카드 + EventBodyToggle + AnnouncementPanel + ApplyLink
- `src/components/WinningLedger.jsx`: 당첨 장부 + 행 컴포넌트
- `src/components/ManagementLists.jsx`: 완료/결과 관리 표
- `src/components/Navigation.jsx`: BottomNav, DesktopNav, SummaryItem, ManageMetrics
- `src/hooks/useEvents.js`: 이벤트 로딩 + 테마
- `src/hooks/useEventActions.js`: status/result/announcement/winning 4종 update 통합
- `src/data/events.js`: 목업 이벤트 데이터
- `src/storage/crawledEventStorage.js`: 크롤링 JSON 로드
- `src/storage/supabaseEventStorage.js`: Supabase 이벤트 로드와 상태 저장
- `src/storage/eventStatusStorage.js`: 이벤트 상태와 참여 결과 localStorage 저장/복원
- `src/styles.css`: Wanted 계열 토큰, Pretendard, 모바일 우선 반응형 스타일
- `vite.config.js`: Vite React 플러그인 설정
- `README.md`: 프로젝트 개요와 실행 방법
- `docs/TODO.md`: 작은 작업 단위 목록
- `docs/DECISIONS.md`: 설계 결정 기록
- `docs/EVENT_SCHEMA.md`: DB 전환을 위한 이벤트 데이터 구조 초안
- `docs/SUPABASE_PLAN.md`: Supabase 전환 계획
- `docs/CRAWLING_SCHEDULE.md`: 크롤링 간격과 자동 실행 정책
- `supabase/schema.sql`: Supabase SQL Editor에서 실행할 테이블 + RLS 정책

## 실행 방법

```bash
npm install
npm run dev
```

슈퍼투데이 이벤트 수집:

```bash
npm run crawl:suto
```

PowerShell 실행 정책 오류가 있으면 다음처럼 실행합니다.

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run crawl:suto
```

빌드 확인:

```bash
npm run build
```

## 아직 구현하지 않은 기능

- 로그인
- 알림
- 이벤트 삭제/수정
- 관리자 기능

## 주의해야 할 설계 결정

- AI 참여는 유튜브 이벤트의 댓글 후보 생성에만 한정합니다.
- 당첨 판별, 오늘마감, 검색, 응모함 정렬, 딸깍 판단은 규칙 기반으로 유지합니다.
- 모바일 앱과 PC 앱을 따로 만들지 않습니다.
- 웹앱, 크롤러, 알림은 강하게 얽히지 않게 분리합니다.
- 처음부터 완성형 서비스를 만들지 않습니다.
- 기능보다 문서와 구조 안정화를 우선합니다.
- 상태값과 데이터 구조는 모바일/PC에서 공유합니다.
- 디자인은 Wanted Design System을 참고하되, 현장 사용성 때문에 버튼 높이와 판독성을 우선합니다.
- 현재 저장 기능은 브라우저 localStorage 기반입니다.
- Cloudflare 확인 화면은 우회하지 않습니다. 접근 가능한 공개 AJAX/HTML만 사용합니다.
- `public/crawled-events.json`은 운영용 DB가 아니라 DB 전환 전 임시 하네스입니다.
- 현재 슈퍼투데이 상세 페이지 본문은 Cloudflare 때문에 수집하지 않고, 목록에서 확보 가능한 원문 제목/링크만 저장합니다.
- Supabase 환경 변수가 없으면 기존처럼 `public/crawled-events.json`과 localStorage로 동작합니다.
- Supabase 환경 변수가 있으면 크롤러는 JSON 대신 DB에 upsert하고, 웹앱은 DB 이벤트를 먼저 읽습니다.
- 로컬 `npm.cmd run verify:supabase`로 Supabase 연결과 이벤트 수를 확인할 수 있습니다.
- GitHub Actions `Crawl Suto Events`는 한국 시간 `09:00`, `15:00`, `21:00`에 실행됩니다.
- 슈퍼투데이 공개 AJAX는 현재 50개를 받아온 뒤 인스타그램/출석류를 제외하며, 최근 확인 기준 DB에는 29개가 저장됐습니다.
- 배포 준비는 `vercel.json`과 `docs/DEPLOYMENT.md`에 정리했습니다.

## 이어받을 때 읽을 순서

1. `README.md`
2. `docs/HANDOFF.md`
3. `docs/DECISIONS.md`
4. `docs/TODO.md`
5. `docs/EVENT_SCHEMA.md`
6. `docs/SUPABASE_PLAN.md`
7. `docs/CRAWLING_SCHEDULE.md`
8. `supabase/schema.sql`
9. `crawler/sutoCrawler.js`
10. `public/crawled-events.json`
11. `src/storage/crawledEventStorage.js`
12. `src/data/events.js`
13. `src/storage/eventStatusStorage.js`
14. `src/App.jsx`
15. `src/styles.css`

## 2026-05-02 UI 코멘트 반영 메모

- `src/App.jsx`의 기본 필터는 `전체보기`다.
- 여기서 `전체보기`는 모든 상태의 전체가 아니라, 아직 처리하지 않은 `ready` 이벤트 전체를 뜻한다.
- 그래서 `전체보기`에서 `나중에`, `참여함`, `제외`를 누르면 이벤트가 현재 목록에서 사라진다.
- 상단 요약 카드 3개는 버튼이다. `현장 딸각`, `결과 미확인`, `당첨` 필터로 바로 이동한다.
- 리스트박스 필터는 모바일에서 불편해서 제거했다.
- 주요 분류(`전체`, `현장`, `나중`, `참여`, `결과`)는 하단 고정 메뉴에서 전환한다.
- 보조 분류(`당첨`, `미당첨`, `제외`)는 목록 상단 칩으로 전환한다.
- `원문 보기` 버튼은 제거했다.
- 카드의 원문 영역은 기본 몇 줄만 보이고, 누르면 펼쳐지는 `details/summary` 구조다.
- `참여하기` 버튼은 `event.applyUrl`을 우선 사용한다.
- 슈퍼투데이 이벤트의 `applyUrl`은 `https://www.suto.co.kr/bbs/link.php?bo_table=cpevent&wr_id={id}&no=1` 형식이다.
- 슈퍼투데이 상세 페이지 본문은 Cloudflare 확인 화면에 막힐 수 있어 우회하지 않는다.
- 현재 카드는 공개 AJAX 목록에서 얻은 원문 제목, 원문 링크, 플랫폼, 저장 수, 목록 순위를 보여준다.
- `당첨` 탭은 슈퍼투데이 가계부/당첨내역 화면을 참고한 전용 장부 화면이다.
- 당첨 이벤트는 `prizeAmount`와 `receiptStatus`를 localStorage에 저장한다.
- `receiptStatus` 값은 `unclaimed`, `requested`, `received`다.
- 2026-05-02 UI 피드백 이후 큰 히어로/좌측 패널 느낌을 줄이고 컴팩트 대시보드형 상단으로 바꿨다.
- 하단 주요 메뉴는 `전체`, `현장`, `나중`, `결과`, `당첨` 5개만 둔다.
- `참여함`, `미당첨`, `제외`는 목록 위 보조 칩으로 둔다.
## 2026-05-09 DB 접근 보호 적용 사항

- `verify-passcode` Edge Function이 비밀번호 secret을 확인하고 30일 유효 토큰을 발급합니다.
- `eventbot-data` Edge Function을 추가해 이벤트 조회, 상태 저장, 필터 설정, 크롤링 상태 조회를 처리합니다.
- GitHub Pages 클라이언트는 Supabase 테이블을 직접 읽거나 쓰지 않고, 잠금 해제 토큰을 `x-eventbot-token` 헤더로 보냅니다.
- 원격 DB 마이그레이션 `202605090001_lock_anon_access.sql`을 적용해 `events`, `app_settings`의 anon 직접 접근을 막았습니다.
- `scripts/verifySupabase.js`가 검증 성공 시 `app_settings.crawl_status`에 전체 이벤트 수와 최신 `last_seen_at`을 저장합니다.
- 앱 상단에 마지막 크롤링 검증 시각, DB 이벤트 수, 최신 수집 시각을 표시합니다.
- AI 댓글 후보 품질 개선은 별도 계획으로 분리했습니다.
