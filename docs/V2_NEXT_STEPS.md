# EventBot v2 — 다음 진행 사항

> 컨텍스트 초기화 후 이어서 작업할 때 이 문서부터 읽기.

---

## 작업 환경

- **메인 repo**: `C:\work\eventbot`
- **브랜치**: `claude/mystifying-nash-9fa802`
- **PR**: https://github.com/jamaica8612/eventbot/pull/1
- **dev 서버**: `npm run dev` → http://localhost:5173/v2-shell.html
- **launch.json**: `.claude/launch.json` (preview용, 포트 5174)

> ⚠️ 작업은 **반드시** 메인 repo (`C:\work\eventbot`)에서. 절대로 `.claude/worktrees/...` 경로로 작업하지 말 것. 이전 세션에서 worktree 리셋으로 작업이 날아간 적 있음.

---

## v2 현재 상태 (커밋 17개, 모두 PR #1에 push됨)

### 갖춰진 기능
- **셸**: PC 3패널(좌 사이드네비 / 중 리스트 / 우 디테일), 모바일 단일 컬럼 + 하단 네비 + 햄버거 드로어 + 바텀시트
- **데이터**: 자동 demo/live 모드 (세션 있으면 Supabase, 없으면 mock+localStorage)
- **필터/검색**: 사이드 네비 7뷰 + 플랫폼 토글 + 필터 칩 + 정렬 5종 + 텍스트 검색(매치 하이라이트+본문 미리보기)
- **액션**: 참여완료/임시저장/제외/복원 + 키보드 단축키(E/L/⌫/J/K/U/?) + 4초 Undo 토스트 + 호버 quick action
- **결과 입력**: 당첨/미당첨 토글, 수령상태, 경품명/금액(한국식 파싱)/메모
- **수령함 KPI**: 누적 당첨금 / 당첨률 / 미수령
- **유튜브**: 정보수집 + 댓글 만들기(Gemini) + 영상 임베드 (16:9, 토글)
- **신규 등록**: FAB/＋ 버튼 → 다이얼로그 (demo 모드만)
- **테마**: 다크/라이트 토글(☀/☾), 영속화
- **영속화**: 3개 키 (`patches` / `ui` / `created`)
- **인증 UI**: AuthBanner (loading/demo/live), Google OAuth

### 미해결 / 제약
- live 모드에서 새 이벤트 직접 추가 불가 (Supabase에 `createEvent` 엔드포인트 없음)
- sync queue 재시도 없음 (네트워크 오류 시 콘솔 warn만)
- Supabase realtime 미구독 (수동 ↻ 새로고침)
- v1과 v2가 공존 (v2-shell.html 별도 entry)

---

## 다음 작업 후보 (가치 순)

### 1순위 — sync queue 재시도 (작음, 안정성↑)
v1의 [src/hooks/useEventActions.js:32-43](src/hooks/useEventActions.js)에 있는 sync queue 패턴을 v2에 이식.

**할 일:**
- `src/v2/lib/syncQueue.js` 만들기 — 실패한 update 큐에 저장
- `useDataSource.updateEvent`에서 실패 시 큐에 push
- 온라인 복귀(`online` 이벤트) + 10초 interval로 flush 시도
- `src/storage/syncQueueStorage.js` 있으면 재사용

### 2순위 — v1 → v2 승격 (결정적 단계)
v2가 충분히 안정적이면 메인으로.

**할 일:**
- 백업 브랜치/폴더로 v1 보존: `mv src src-v1-backup`
- `index.html` → v2-shell.html 내용으로 교체 (또는 v2.html 진입을 index에 inline)
- `src/v2/*` → `src/*`로 평탄화
- import 경로 정리 (../storage → ./storage 등)
- vite.config 정리

> ⚠️ 큰 결정. 별도 PR로 분리. 사용자 컨펌 필수.

### 3순위 — Supabase realtime 구독 (중간 사이즈)
다른 디바이스/세션 변경이 자동 반영.

**할 일:**
- `useDataSource`에 `supabase.channel('events').on('postgres_changes', ...)` 구독 추가
- 변경 이벤트 → 해당 row만 setEvents 갱신
- 페이지 보이지 않을 때(visibilitychange) 구독 해제 후 재진입 시 refresh

### 4순위 — createEvent 백엔드 (큼)
live 모드에서 새 이벤트 추가 가능하게.

**할 일:**
- Supabase Edge Function `eventbot-data`에 `action: 'createEvent'` 추가
- 또는 `events` 테이블 직접 insert (권한 RLS 검토)
- `useDataSource.addEvent`가 live 모드일 때 호출
- 클라이언트 측 검증 (필수 필드, 길이 제한)

### 5순위 — PWA / 알림 (큼)
- 기존 `src/pwa.js`가 v1용. v2에도 적용.
- service worker / manifest 통합
- 마감 임박 알림 (선택)

### 폴리시 후보 (작음)
- 모바일 sheet 좌우 스와이프 제스처
- 토스트 스택 (여러 액션 빠르게 했을 때)
- 카드 진행 단계 visualization (응모대기 → 완료 → 발표 → 결과)
- 검색 히스토리 (최근 5개)
- onboarding 투어
- 어드민 패널 v2 (v1의 AdminPanel 포팅)
- 라이트 테마 색상 미세 조정 (사용해보고 거슬리는 부분)

---

## 핵심 파일 위치

```
src/v2/
  AppDemo.jsx              # 메인 컴포넌트, 상태 통합
  Showcase.jsx             # 디자인 시스템 데모 (/v2.html)
  main.jsx / main-shell.jsx  # 진입점
  tokens.css               # 색상/타이포/간격/라운드/그림자 토큰
  
  components/
    primitives.{jsx,css}   # Button/Tag/Pill/Card/Avatar/Input 등
    EventCard.{jsx,css}    # 리스트 카드 (호버 quick action 포함)
    EventDetailContent.{jsx,css}  # 디테일 본문 + 유튜브 + 댓글 + 임베드
    ResultEntry.{jsx,css}  # 당첨/수령/메모 입력
    InboxSummary.{jsx,css} # 수령함 KPI
    PlatformChip.{jsx,css} # 플랫폼 색상 칩/썸네일
    KeyboardHelp.{jsx,css} # ? 키 모달
    NewEventDialog.{jsx,css}  # 새 이벤트 폼
    AuthBanner.{jsx,css}   # 데모/라이브 상단 바
    Highlight.jsx          # 검색 매치 강조
  
  shell/
    AppShell.{jsx,css}     # 반응형 셸 (AppShell, SideNav, TopBar, ListPanel, DetailPanel, BottomNav, Placeholder, useEscape)
    shell.css              # + 햄버거 드로어 / 바텀시트 스타일
  
  lib/
    useDataSource.js       # demo/live 자동 + 액션 동기화
    eventStore.js          # localStorage (patches/ui/created)
    youtubeCard.js         # v1 EventBodyToggle 헬퍼 추출
    deadline.js            # 마감일 자동 계산
    theme.js               # 다크/라이트 토글

v2.html        # /v2.html — Showcase 진입
v2-shell.html  # /v2-shell.html — 실제 앱 진입
```

### 재사용 중인 v1 모듈 (절대 수정 금지, v1도 영향)
- `src/storage/supabaseEventStorage.js` — loadSupabaseEvents, updateSupabaseEventState
- `src/storage/supabaseAuthStorage.js` — getCurrentSession, onAuthStateChange, signInWithGoogle, signOut, onAuthRequired
- `src/utils/eventModel.js` — buildUserContentLines, hasCrawledBody
- `api/youtubeTranscriptCore.js`, `api/youtubeCommentGenerator.js` (vite middleware)

---

## 작업 흐름 가이드

1. 새 컨텍스트 시작 시 이 문서 + [docs/HANDOFF.md](docs/HANDOFF.md) 먼저 읽기
2. `cd C:\work\eventbot && git status && git log --oneline -10` 으로 현재 위치 확인
3. 작업은 **반드시** 의미 있는 단위마다 commit (잃지 않게)
4. `dev.log` 같은 임시 파일은 절대 commit 금지 — `.gitignore` 추가
5. PowerShell here-string으로 한글 커밋 메시지 작성 시 깨짐 — 파일에 메시지 쓰고 `git commit -F`
6. preview tool은 `.claude/launch.json` 필요. 죽으면 `preview_start v2-showcase`로 재시작
7. 큰 결정(v1 교체, DB 스키마 변경 등)은 사용자 컨펌 받기

---

## 확인된 동작 (테스트 완료)
- 유튜브 정보수집: BTS Dynamite 영상으로 실제 API 호출 → 메타데이터 fetch 성공
- 본문 펼치기 / 액션바 / 키보드 / 토스트 / 모바일 햄버거 / 시트 prev/next / 다크-라이트 토글 — 모두 동작 확인
- 데이터 영속화: 새로고침 후에도 selectedView, selectedId, 액션 결과 복원

---

_작성: 2026-05-19 / 마지막 커밋 `26252bf` (Supabase live data integration)_
