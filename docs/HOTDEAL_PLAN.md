# 커뮤니티 핫딜 + 텔레그램 알림 기획

eventbot(당첨노트)에 **커뮤니티 핫딜 수집 + 텔레그램 알림**을 붙이는 설계. 기존 인프라(Supabase · Python 크롤러 · GitHub Actions · v2 UI)를 최대한 재사용한다. 무료/저비용 운영(GitHub Actions + Supabase 무료 티어 + 텔레그램 무료 Bot API) 전제.

## 1. 개요

- **수집 대상**: 뽐뿌(ppomppu), 루리웹, 클리앙 등 커뮤니티 핫딜 게시판.
- **핵심 가치**: 이벤트(무료 응모·당첨 관리)와 달리 핫딜은 **시간 민감(품절/가격변동)** → 빠른 알림이 생명. 그래서 텔레그램 push가 중심.
- **이벤트와 분리**: 도메인이 다르므로(이벤트=응모/당첨, 핫딜=구매 결정) 별도 테이블·별도 탭·별도 어댑터. 디자인 시스템(토큰/프리미티브)만 공유.

## 2. 아키텍처

```
[뽐뿌/루리웹/클리앙]
   │ Python 크롤러(curl_cffi, Cloudflare 우회)   ← crawler/hotdeal/
   ▼
[Supabase: hotdeals 테이블]
   │                              └─→ 새 핫딜 감지
   │ Edge Function: hotdeal-data         │
   ▼                                     ▼
[v2 앱: 핫딜 탭]            [Edge Function: telegram-notify]
                                         │ sendMessage(chat_id, ...)
                                         ▼
                            [텔레그램 봇 ← 구독자 N명]
                                         ▲
                            [Edge Function: telegram-webhook]
                              /start, /keyword 등록 → telegram_subscribers
```

## 3. 데이터 모델 (Supabase)

### `hotdeals`
| 컬럼 | 설명 |
|---|---|
| `id` | PK |
| `source` | `ppomppu`/`ruliweb`/`clien` |
| `source_post_id` | 원본 글 ID |
| `title` | 제목 |
| `price` | 가격 텍스트(파싱 전 원문 + 정규화 숫자) |
| `shop` | 쇼핑몰(쿠팡/11번가 등) |
| `category` | 분류(컴퓨터/생활/식품…) |
| `url` | 원본 글 링크 |
| `deal_url` | 실제 상품 링크(있으면) |
| `thumbnail` | 썸네일 |
| `recommend_count` / `comment_count` | 추천/댓글 수(인기도) |
| `posted_at` | 게시 시각 |
| `is_sold_out` / `is_expired` | 품절/종료 |
| `first_seen_at` / `last_seen_at` | 수집 시각 |
| `raw` | 원본 JSON |

**중복 기준**: `source + source_post_id`. 재수집 시 가격/품절/추천수/`last_seen_at` 갱신.

### `telegram_subscribers`
| 컬럼 | 설명 |
|---|---|
| `chat_id` | 텔레그램 채팅 ID (PK) |
| `user_id` | 앱 사용자 연동(nullable) |
| `keywords` | 관심 키워드 배열(예: `["3070","SSD"]`) |
| `categories` | 관심 카테고리 |
| `min_recommend` | 최소 추천수 필터(스팸 방지) |
| `active` | 구독 활성 |
| `created_at` | |

## 4. 크롤러 (기존 패턴 재사용)

- `crawler/hotdeal/` 디렉토리. `crawler/sutoCurlCffiSource.py`의 **curl_cffi 크롬 위장 + 재시도/백오프** 패턴 그대로(Cloudflare 우회는 이미 검증됨 — 유튜브 redirect 사건에서 확인).
- 사이트별 파서: `ppomppu.py`, `ruliweb.py`, `clien.py` — 핫딜 게시판 목록 파싱(제목/가격/쇼핑몰/추천/링크).
- 저장: `crawler/supabaseEventRepository.js` 패턴을 본떠 `hotdealRepository`로 upsert(`source+source_post_id` 충돌 시 갱신).
- 자동 실행: **별도 GitHub Actions 워크플로**(`.github/workflows/crawl-hotdeal.yml`). 핫딜은 시간 민감하므로 이벤트(하루 3회)보다 자주 — **30분~1시간 간격** 권장.

## 5. 텔레그램 알림 — "봇 하나, 여러 사용자" 동작 방식

**가능합니다. 표준 패턴이에요.** 봇 토큰은 1개, 사용자별로 `chat_id`가 다릅니다.

1. **구독 등록**: 사용자가 봇을 찾아 `/start` → 텔레그램이 봇 **webhook**으로 그 사용자의 `chat_id`를 담은 업데이트 전송 → Edge Function `telegram-webhook`이 `telegram_subscribers`에 `chat_id` 저장.
2. **키워드 설정**: `/keyword 그래픽카드` 같은 봇 명령 또는 앱 설정 화면 → `keywords` 갱신.
3. **알림 발송**: 크롤 후 신규 핫딜 감지 → Edge Function `telegram-notify`가 구독자를 순회하며 **키워드/카테고리/최소추천수 매칭** → 매칭된 `chat_id`에게 `sendMessage(chat_id, "제목 · 가격 · 쇼핑몰 + 링크")`.
4. **rate limit**: 텔레그램은 초당 ~30 메시지 제한 → 배치 + 약간의 딜레이로 발송. 구독자 많아지면 큐잉.
5. **봇 토큰**은 Edge Function Secret(`TELEGRAM_BOT_TOKEN`)으로만. 브라우저 노출 금지.

> 핵심: 한 봇이 N명에게 보내는 건 각 사용자의 `chat_id`로 개별 `sendMessage`를 호출하는 것. 채널 구독과 달리 1:1 DM이라 사용자별 키워드 필터가 자연스럽다.

## 6. UI (v2 디자인 재사용)

- NAV에 **"핫딜" 탭** 추가(기존 `NavItem`/토큰/프리미티브 그대로).
- **핫딜 카드**: 쇼핑몰 배지 + 가격(`.tnum`) + 제목 + 추천/댓글 + **품절(`--lose`)·종료(`--urgent`)·인기(`--warn`) 배지** + [바로가기]. 주의 위계(DESIGN_RULES §7) 그대로 적용.
- **어댑터 분리**: `src/v2/lib/hotdealAdapter.js`(`toHotdeal`), 도메인 표시값 `hotdealDomain.js`. 이벤트 어댑터와 독립.
- **필터**: 카테고리/쇼핑몰/품절 숨김/최소 추천수.
- 텔레그램 구독 설정(키워드·카테고리)도 필터 드로어나 별도 화면에서.

## 7. 단계별 로드맵 (MVP부터)

1. **DB+크롤러 MVP**: `hotdeals` 테이블 + 뽐뿌 1개 사이트 크롤러 + Supabase upsert.
2. **자동 실행**: `crawl-hotdeal.yml` GitHub Actions(30분 간격).
3. **읽기 경로**: `hotdeal-data` Edge Function + v2 핫딜 탭(카드/필터).
4. **텔레그램 봇**: BotFather 토큰 → `telegram-webhook`(구독 등록) → `telegram_subscribers`.
5. **알림 발송**: `telegram-notify`(신규 핫딜 → 키워드 매칭 → 발송).
6. **확장**: 루리웹/클리앙 파서 추가, 키워드 구독 UI, 가격 추이.

## 8. 구현 에이전트 구성 (제안)

병렬 가능한 3개 작업 단위 + 선행:

- **선행(공통)**: `hotdeals`/`telegram_subscribers` 테이블 마이그레이션 + 도메인 타입.
- **에이전트 A — 크롤러**: `crawler/hotdeal/*` 파서 + upsert + GitHub Actions. (의존: 선행)
- **에이전트 B — 텔레그램**: `telegram-webhook` + `telegram-notify` Edge Function + 구독/발송. (의존: 선행)
- **에이전트 C — UI**: v2 핫딜 탭 + 어댑터 + 필터 + 구독 설정. (의존: 선행, 크롤러 데이터로 검증)

A·B·C는 선행 완료 후 병렬. 통합 시 크롤러→DB→알림/UI 순으로 연결 검증.

## 9. 리스크

- **Cloudflare/봇 차단**: 크롤러는 curl_cffi로 우회(검증됨). 단 사이트 구조 변경 시 파서 유지보수 필요.
- **텔레그램 rate limit / 차단**: 대량 발송 시 배치·딜레이. 사용자가 봇 차단하면 `active=false` 처리.
- **스팸 피로**: 키워드/최소추천수 필터 필수. 기본은 보수적으로.
- **무료 티어 한계**: Supabase row/대역폭, GitHub Actions 분 — 핫딜 빈도(30분)면 충분하나 모니터링.
- **도메인 혼선**: 이벤트와 핫딜을 코드/UI에서 확실히 분리(별도 테이블/어댑터/탭).
