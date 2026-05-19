# v1 reskin (v2 셸 입히기) — 핸드오프

> 이전 세션에서 컨텍스트 초기화. 다음 세션은 이 문서부터 읽기.

---

## 결정된 방향

**v1은 메인 유지. v1 기능 100% 보존하면서 디자인만 v2 톤으로.**
이전 v2 standalone 작업(PR #1)은 백업 브랜치로 보존, 메인 노선은 v1 reskin.

---

## 브랜치 지도

| 브랜치 | 용도 | 상태 |
|---|---|---|
| `main` | v1 production | 살아있음 |
| `claude/v2-skin-on-v1` | **현재 작업 브랜치** | 1단계 commit 완료 (`87d34be`) |
| `claude/mystifying-nash-9fa802` (PR #1) | v2 standalone 전체 | 머지 보류 — 참고용 |
| `backup/v2-standalone-2026-05-19` | v2 standalone 백업 | 안전 |

---

## reskin 단계 계획

### 1단계 — 토큰 매핑 ✅ 완료 (`87d34be`)
`src/styles.css`의 `:root` + `html[data-theme="light"]` 블록만 v2 톤으로 교체.
- `--wanted-blue`: yellow `#ffd24a` → indigo `#818cf8` (다크) / `#4f46e5` (라이트)
- surface/text/border: v2 다크 톤 (`#14171f` 계열)
- semantic(success/danger/warn): v2 진한 톤
- 룰/컴포넌트 모양은 **그대로**

**검증 필요**: dev 서버 띄워서 v1 화면이 새 색감으로 나오는지 확인. 깨진 곳 picking.

### 2단계 — 컴포넌트를 v2 primitives 기반으로
v1 컴포넌트들의 className/구조를 v2 primitive와 가깝게 재작성. 한 번에 다 하지 말고 컴포넌트 하나씩.

대상 (`src/components/`):
- `Navigation.jsx` (BottomNav / DesktopNav / SummaryItem / ManageMetrics)
- `EventCards.jsx`
- `EventInbox.jsx`
- `EventSearch.jsx`
- `EventBodyToggle.jsx`
- `PlatformBadge.jsx`
- `AdminPanel.jsx`

참고: v2 primitives는 `src/v2/components/primitives.{jsx,css}`에 정의 (PR #1 브랜치 또는 백업 브랜치에서 확인).

방법: v2 primitives를 v1으로 cherry-pick / 복사 후 import. 또는 직접 v1 컴포넌트의 CSS를 v2 모양으로 (라운드, 패딩, 그림자) 재작성.

### 3단계 — 셸 구조 (선택)
`App.jsx`의 render를 v2 `AppShell`(좌 네비 / 중 리스트 / 우 디테일) 구조로 wrapping. 가장 큼.

---

## 작업 환경 주의

- **메인 repo**: `C:\work\eventbot` — 현재 `claude/mystifying-nash-9fa802` 체크아웃 (건드리지 말 것)
- **이 worktree**: `C:\work\eventbot\.claude\worktrees\priceless-matsumoto-fd1f49` — `claude/v2-skin-on-v1` 체크아웃, 여기서 작업
- 파일 편집 시 **반드시 worktree 절대경로** 사용. 그냥 `C:\work\eventbot\src\styles.css`로 편집하면 v2 브랜치(메인 repo)에 들어감 — 이전 세션 실수.
- dev 서버: 메인 repo는 v2(데모) 띄워져 있을 수 있음. 충돌 시 포트 변경(`npm run dev -- --port 5175`).

---

## v1 src 구조 빠른 참고

```
src/
  App.jsx                      # 1091줄, 메인 컴포넌트
  main.jsx                     # entry
  pwa.js                       # SW 비활성화(unregister) — 그대로 유지
  styles.css                   # 3621줄, 단일 CSS. 1단계는 :root만 수정
  constants.js                 # primaryFilters 등
  components/
    Navigation.jsx             # BottomNav / DesktopNav
    EventCards.jsx
    EventInbox.jsx
    EventSearch.jsx
    EventBodyToggle.jsx
    EventShared.jsx
    PlatformBadge.jsx
    AdminPanel.jsx
  hooks/useEventActions.js     # sync queue 포함 — 핵심
  storage/
    supabaseAuthStorage.js     # Google OAuth
    supabaseEventStorage.js    # loadEvents / updateEventState / createEvent / updateProfileAccess
    syncQueueStorage.js
    eventStatusStorage.js
    excludedEventStorage.js
  utils/
    eventModel.js
    format.js
  data/...
```

---

## 1단계 검증 방법

```
cd C:\work\eventbot\.claude\worktrees\priceless-matsumoto-fd1f49
npm run dev -- --port 5175
```
브라우저: http://localhost:5175/

확인할 것:
- 다크 테마 / 라이트 테마 둘 다 깨진 곳 없는지
- 노란 brand가 indigo로 잘 바뀌었는지
- CTA 버튼 텍스트 가독성 (다크에서 brand-on `#1a1740`이 너무 어두울 가능성)
- 카드 / 네비 / 칩 색감

picking 결과는 다시 `styles.css :root`에서 토큰 값만 조정.

---

## 일반 가이드

- v1 기능에 영향 가는 변경은 금지. CSS/디자인만 손대고 로직(.jsx)은 절대 안 건드림 (1단계까지).
- 2단계부터 .jsx 수정 시작하되 기능 보존이 최우선.
- 큰 결정(컴포넌트 통째 교체, App.jsx 재구조) 전에 사용자 컨펌.
- 의미 단위마다 commit. 한글 메시지는 `git commit -F` (PowerShell here-string 깨짐).

---

_작성: 2026-05-19 / 1단계 마지막 commit `87d34be` (style: reskin v1 tokens to v2 tone)_
