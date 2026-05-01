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

## 다음에 해야 할 작업

1. Supabase 프로젝트를 만들고 `supabase/schema.sql`을 실행합니다.
2. `.env.local`에 `.env.example` 기준으로 Supabase URL과 키를 넣습니다.
3. `npm run crawl:suto`로 슈퍼투데이 이벤트가 DB에 upsert되는지 확인합니다.
4. 웹앱이 DB에서 이벤트를 읽고 상태 변경을 저장하는지 확인합니다.
5. Supabase 연결 후 GitHub Actions 하루 3회 자동 실행을 설계합니다.
6. 모바일 실제 화면을 확인하고 글자 크기와 버튼 크기를 조정합니다.

## 중요한 파일 위치

- `crawler/sutoCrawler.js`: 슈퍼투데이 이벤트 수집기
- `crawler/supabaseEventRepository.js`: Supabase 환경 변수가 있을 때 크롤링 결과를 DB에 upsert하는 저장소
- `public/crawled-events.json`: 크롤링 결과 JSON
- `src/App.jsx`: 현재 단일 화면 UI와 상태 변경 흐름
- `src/data/events.js`: 목업 이벤트 데이터
- `src/storage/crawledEventStorage.js`: 크롤링 JSON 로드
- `src/storage/supabaseEventStorage.js`: Supabase 이벤트 로드와 상태 저장
- `src/storage/eventStatusStorage.js`: 이벤트 상태 localStorage 저장/복원
- `src/storage/eventStatusStorage.js`: 이벤트 상태와 참여 결과 localStorage 저장/복원
- `src/styles.css`: Wanted 계열 토큰, Pretendard, 모바일 우선 반응형 스타일
- `vite.config.js`: Vite React 플러그인 설정
- `README.md`: 프로젝트 개요와 실행 방법
- `docs/TODO.md`: 작은 작업 단위 목록
- `docs/DECISIONS.md`: 설계 결정 기록
- `docs/EVENT_SCHEMA.md`: DB 전환을 위한 이벤트 데이터 구조 초안
- `docs/SUPABASE_PLAN.md`: Supabase 전환 계획
- `docs/CRAWLING_SCHEDULE.md`: 크롤링 간격과 자동 실행 정책
- `supabase/schema.sql`: Supabase SQL Editor에서 실행할 테이블 초안

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
- 데이터베이스
- 알림
- AI 댓글 생성
- 유튜브 스크립트 보기
- 이벤트 삭제/수정
- 크롤링 스케줄러
- 관리자 기능

## 주의해야 할 설계 결정

- AI 댓글 생성 앱으로 만들지 않습니다.
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
