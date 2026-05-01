# EVENT_SCHEMA

자동 수집 이벤트를 DB에 저장하기 위한 1차 데이터 구조입니다.

## 핵심 목표

- 크롤러가 가져온 이벤트를 중복 없이 저장합니다.
- 모바일에서는 짧게 보고 `나중에`, `참여함`, `제외`를 딸각 처리합니다.
- PC에서는 집에서 원문을 열고 정리할 수 있게 합니다.
- AI 댓글 생성은 포함하지 않습니다.

## events 테이블 초안

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | text 또는 uuid | 앱 내부 이벤트 ID |
| `source_site` | text | 예: `suto` |
| `source_name` | text | 예: `슈퍼투데이` |
| `source_event_id` | text | 원본 사이트 이벤트 ID |
| `title` | text | 이벤트 제목 |
| `url` | text | 원문 링크 |
| `platform` | text | 인스타그램, 유튜브, 홈페이지 등 |
| `rank` | integer | 수집 목록 안에서의 순위 |
| `bookmark_count` | integer | 슈퍼투데이 저장/북마크 수 |
| `due_text` | text | 마감 표시 텍스트 |
| `click_score` | integer | 현장 딸깍 가능성 점수, 0~100 |
| `action_type` | text | `now`, `home`, `skip` |
| `estimated_seconds` | integer | 예상 처리 시간(초) |
| `decision_reason` | text | 규칙 기반 판단 이유 |
| `prize_text` | text | 보상/상품 표시 텍스트 |
| `deadline_text` | text | 앱에 보여줄 마감 문구 |
| `effort` | text | `quick`, `home`, `hard` |
| `status` | text | `ready`, `later`, `done`, `skipped` |
| `result_status` | text | `unknown`, `won`, `lost` |
| `participated_at` | timestamptz | 참여 처리한 시간 |
| `result_checked_at` | timestamptz | 당첨/미당첨 결과를 확인한 시간 |
| `memo` | text | 앱에서 보여줄 짧은 메모 |
| `first_seen_at` | timestamptz | 처음 수집된 시간 |
| `last_seen_at` | timestamptz | 마지막으로 다시 발견된 시간 |
| `created_at` | timestamptz | DB 생성 시간 |
| `updated_at` | timestamptz | DB 수정 시간 |

## 중복 판단

1차 중복 기준은 다음 조합입니다.

```text
source_site + source_event_id
```

슈퍼투데이는 URL이 `https://www.suto.co.kr/cpevent/631805` 형태라서 `631805`를 `source_event_id`로 사용합니다.

## 상태값

- `ready`: 아직 판단하지 않음
- `later`: 집에서 다시 볼 것
- `done`: 참여 완료
- `skipped`: 제외

## 참여 결과값

- `unknown`: 참여했지만 결과 미확인
- `won`: 당첨
- `lost`: 미당첨

`참여함`을 누르면 기본 결과값은 `unknown`입니다. 당첨/미당첨은 사용자가 직접 확인 후 누릅니다.

## 처리 난이도

- `quick`: 현장에서 짧게 처리 가능
- `home`: 댓글, 유튜브, 인스타 등 집에서 처리하는 편이 나음
- `hard`: 설문, 공모, 긴 작성 등 복잡함

## JSON 하네스와 DB 매핑

현재 `public/crawled-events.json`은 DB 전환 전 임시 저장소입니다.

| JSON 필드 | DB 필드 |
| --- | --- |
| `id` | `id` 또는 `source_site + source_event_id` 기반 생성 |
| `title` | `title` |
| `originalTitle` | `title` |
| `originalUrl` | `url` |
| `source` | `source_name`, `platform`으로 분리 예정 |
| `platform` | `platform` |
| `rank` | `rank` |
| `bookmarkCount` | `bookmark_count` |
| `due` | `due_text` |
| `clickScore` | `click_score` |
| `actionType` | `action_type` |
| `estimatedSeconds` | `estimated_seconds` |
| `decisionReason` | `decision_reason` |
| `prizeText` | `prize_text` |
| `deadlineText` | `deadline_text` |
| `effort` | `effort` |
| `effortLabel` | UI 표시값, DB 필수 아님 |
| `status` | `status` |
| `resultStatus` | `result_status` |
| `participatedAt` | `participated_at` |
| `resultCheckedAt` | `result_checked_at` |
| `memo` | `memo` |
| `url` | `url` |
| `crawledFrom` | `source_name` |

## 다음 결정

- Supabase 1차 초안은 `docs/SUPABASE_PLAN.md`와 `supabase/schema.sql`에 작성했습니다.
- `status`를 사용자별로 분리할지 결정합니다.
- 로그인 전까지는 단일 사용자 기준으로 단순하게 시작합니다.
