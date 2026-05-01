# 이벤트 딸각 웹앱

밤에 택배 일을 하면서도 짧은 시간에 이벤트를 확인하고 처리할 수 있게 돕는 모바일 우선 반응형 웹앱입니다.

이 앱은 이벤트를 많이 보여주는 앱이 아니라, 실제 생활 중에 처리 가능한 이벤트를 빠르게 판단하고 상태를 정리하는 앱을 목표로 합니다.

현재 방향의 핵심은 **자동 수집 → 저장 → 모바일 딸각 관리**입니다.

## 사용자의 실제 상황

- 밤에 택배 일을 하며 업무 중 폰을 오래 볼 수 없습니다.
- 현장에서는 짧고 단순한 이벤트만 처리할 수 있습니다.
- 유튜브 댓글 이벤트나 정성 댓글 이벤트는 집에 와서 처리하는 편이 현실적입니다.
- 모바일은 현장 딸각용, PC는 집에서 정리/참여용입니다.
- 모바일과 PC는 하나의 반응형 웹앱으로 만들고 같은 데이터와 상태값을 공유합니다.
- 디자인 품질도 중요하게 보며, Wanted Design System을 시각 기준으로 삼습니다.
- 무료 또는 저비용으로 운영 가능한 구조를 선호합니다.

## 현재 범위

- Vite + React 기반의 최소 웹앱 뼈대
- 모바일 우선 단일 화면
- 목업 이벤트 목록
- 슈퍼투데이 인기 이벤트 1차 크롤러
- 크롤링 이벤트 원문 링크 열기
- 이벤트 상태 버튼: 나중에, 참여함, 제외
- 새로고침 후에도 이벤트 상태가 남는 localStorage 저장
- PC 화면으로 자연스럽게 넓어지는 반응형 레이아웃
- Wanted Design System 참고 스타일
- Pretendard 폰트 적용

## 아직 하지 않는 것

- AI 댓글 생성
- 실제 로그인
- 실제 DB 저장
- 크롤러
- 직접 이벤트 추가
- 알림 기능
- 복잡한 관리자 기능
- 모바일 앱과 PC 앱의 분리 개발

## 실행 방법

```bash
npm install
npm run dev
```

빌드 확인:

```bash
npm run build
```

슈퍼투데이 이벤트 수집:

```bash
npm run crawl:suto
```

수집 결과는 `public/crawled-events.json`에 저장되고 웹앱 시작 시 자동으로 목록에 합쳐집니다.

`public/crawled-events.json`은 운영용 DB가 아니라 DB 전환 전 구조를 확인하기 위한 임시 하네스입니다.

PowerShell에서 `npm` 실행 정책 오류가 나면 Windows 명령 파일을 직접 실행합니다.

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run crawl:suto
```

## 이어받기

다른 AI 코딩 도구나 사람이 이어받을 때는 다음 순서로 읽습니다.

1. `README.md`
2. `docs/HANDOFF.md`
3. `docs/DECISIONS.md`
4. `docs/TODO.md`
5. `docs/EVENT_SCHEMA.md`
6. `docs/SUPABASE_PLAN.md`
7. `docs/CRAWLING_SCHEDULE.md`
