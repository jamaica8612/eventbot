# SUPABASE_PLAN

이 문서는 `크롤러 -> DB -> 웹앱 -> 모바일 딸각 관리`로 가기 위한 Supabase 1차 설계입니다.

## 목표

- 크롤러가 가져온 이벤트를 DB에 저장합니다.
- 같은 이벤트는 중복 저장하지 않고 `last_seen_at`만 갱신합니다.
- 웹앱은 JSON 대신 DB에서 이벤트를 읽는 구조로 바꿀 수 있게 준비합니다.
- 로그인 전까지는 단일 사용자 기준으로 단순하게 시작합니다.

## 1차 테이블

처음에는 `events` 테이블 하나로 시작합니다.

상태값까지 `events.status`에 같이 둡니다. 나중에 로그인/다중 사용자가 필요해지면 `event_statuses` 테이블로 분리합니다.

## events 컬럼

| 컬럼 | 설명 |
| --- | --- |
| `id` | DB 내부 ID |
| `source_site` | 수집 출처 코드. 예: `suto` |
| `source_name` | 수집 출처 이름. 예: `슈퍼투데이` |
| `source_event_id` | 원본 사이트 이벤트 ID |
| `title` | 이벤트 제목 |
| `url` | 원문 링크 |
| `platform` | 인스타그램, 유튜브, 홈페이지 등 |
| `rank` | 수집 목록 안 순위 |
| `bookmark_count` | 슈퍼투데이 저장/북마크 수 |
| `due_text` | 마감 텍스트 |
| `effort` | `quick`, `home`, `hard` |
| `status` | `ready`, `later`, `done`, `skipped` |
| `result_status` | `unknown`, `won`, `lost` |
| `participated_at` | 참여 처리한 시간 |
| `result_checked_at` | 당첨/미당첨 확인 시간 |
| `memo` | 앱에서 보여줄 짧은 메모 |
| `raw` | 원본 수집 데이터 JSON |
| `first_seen_at` | 처음 수집된 시간 |
| `last_seen_at` | 마지막 수집 확인 시간 |
| `created_at` | 생성 시간 |
| `updated_at` | 수정 시간 |

## 중복 방지

중복 기준:

```text
source_site + source_event_id
```

예:

```text
suto + 631805
```

같은 이벤트가 다시 수집되면 새 행을 만들지 않고 제목, 링크, 플랫폼, 마감, 난이도, 메모, `last_seen_at`을 업데이트합니다.

## 현재 슈퍼투데이 수집 상태

- 수집 입구: 공개 AJAX 인기 이벤트 목록
- 상세 페이지: Cloudflare 확인 화면이 나올 수 있어 우회하지 않음
- 현재 저장 가능: 원문 제목, 원문 링크, 플랫폼, 목록 순위, 북마크 수
- 제외 조건: 인스타그램 이벤트는 저장하지 않음

## 크롤러 저장 흐름

```text
npm run crawl:suto
-> 슈퍼투데이 AJAX 목록 수집
-> 이벤트 배열 생성
-> Supabase events 테이블에 upsert
```

## 웹앱 읽기 흐름

```text
웹앱 실행
-> Supabase events 테이블에서 status != skipped 이벤트 조회
-> 기존 localStorage 상태 저장은 DB 전환 후 제거 또는 보조용으로 축소
```

## 참여 결과 관리

- `참여함` 클릭 시 `status = done`, `result_status = unknown`으로 저장합니다.
- 사용자가 결과를 확인한 뒤 `당첨` 또는 `미당첨`을 직접 선택합니다.
- 자동 당첨 판별은 현재 범위에서 제외합니다.

## 환경 변수

Supabase 연결에는 다음 값이 필요합니다.

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- `VITE_` 값은 웹앱에서 읽는 공개 키입니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 크롤러에서 DB에 쓰기 위한 서버용 키입니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저 코드에 넣지 않습니다.

## 다음 구현 순서

1. Supabase 프로젝트를 만듭니다.
2. `supabase/schema.sql`을 Supabase SQL Editor에서 실행합니다.
3. `.env.local`에 Supabase URL과 키를 넣습니다.
4. `npm run crawl:suto`로 DB upsert를 확인합니다.
5. 웹앱에서 DB 이벤트 로드와 상태 저장을 확인합니다.
6. GitHub Actions 자동 실행을 붙입니다.

## 구현 상태

- `.env.example`에 필요한 환경 변수 이름을 추가했습니다.
- `crawler/supabaseEventRepository.js`를 추가했습니다.
- Supabase 환경 변수가 있으면 `npm run crawl:suto`는 JSON 파일 대신 `events` 테이블에 upsert합니다.
- Supabase 환경 변수가 없으면 기존처럼 `public/crawled-events.json`에 저장합니다.
- 웹앱은 Supabase 환경 변수가 있으면 DB 이벤트를 먼저 읽고, 데이터가 없으면 JSON으로 폴백합니다.
- 상태 변경, 결과 변경, 당첨 금액/수령 상태 변경은 localStorage에 저장하면서 Supabase에도 업데이트를 시도합니다.

## 보류

- 로그인
- 사용자별 상태 분리
- 자동 주기 실행
- 알림
- AI 댓글 생성
