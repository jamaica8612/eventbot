# DEPLOYMENT

## 목표

웹앱은 GitHub Pages에 배포하고, 크롤러는 GitHub Actions에서 Supabase DB로 저장합니다.

## GitHub Pages 배포

Vercel에서 Pro 팀 생성/카드 입력 흐름이 나와서 GitHub Pages 배포를 우선 사용합니다.

GitHub Actions의 `Deploy GitHub Pages` 워크플로가 `main` 브랜치 push마다 앱을 빌드하고 배포합니다.

필요한 GitHub Secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

배포 주소:

```text
https://jamaica8612.github.io/eventbot/
```

## Vercel 배포

1. Vercel에서 `jamaica8612/eventbot` GitHub 저장소를 import합니다.
2. Framework Preset은 `Vite`를 사용합니다.
3. Build Command는 `npm run build`입니다.
4. Output Directory는 `dist`입니다.
5. Environment Variables에 다음 값을 추가합니다.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY
```

`SUPABASE_SERVICE_ROLE_KEY`는 Vercel에 넣지 않습니다. 이 키는 크롤러와 GitHub Actions에서만 사용합니다.

GitHub Pages에서 댓글 후보 만들기는 Supabase Edge Function으로 실행합니다. Function Secret에 다음 값을 추가합니다.

```text
GEMINI_API_KEY
```

프론트는 배포 환경에서 자동으로 `${VITE_SUPABASE_URL}/functions/v1/youtube-transcript`를 호출합니다. localhost에서는 기존 Vite dev server의 `/api/youtube-transcript`를 사용합니다.

## GitHub Actions Secrets

자동 크롤링에는 GitHub 저장소 Secrets가 필요합니다.

```text
VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## 배포 후 확인

1. 모바일 브라우저에서 배포 URL을 엽니다.
2. 슈퍼투데이 이벤트가 보이는지 확인합니다.
3. 이벤트 하나를 `나중에`로 바꾸고 새로고침합니다.
4. 상태가 유지되면 Supabase 읽기/쓰기가 연결된 것입니다.

## 주의

- 현재는 로그인 없는 개인용 앱입니다.
- Supabase RLS 정책은 공개 읽기와 공개 업데이트를 허용합니다.
- 배포 URL을 넓게 공유하기 전에는 로그인 또는 간단한 접근 제한을 추가하는 것이 좋습니다.
