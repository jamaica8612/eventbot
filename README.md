# EventBot

EventBot is a responsive web app for tracking online events, deadlines, results, and hot deals.

## Public app

- Vite + React frontend deployed with GitHub Pages.
- Google sign-in is provided by Supabase Auth.
- The Pages address remains `https://jamaica8612.github.io/eventbot/`.
- This repository contains only the browser app and Pages workflows. Server credentials are never stored here.

## Configuration

Create `.env.local` from `.env.example` and provide the public Supabase browser settings:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

In Supabase Auth, keep `https://jamaica8612.github.io/eventbot/` in the allowed redirect URLs for Google sign-in.

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

For a Pages-equivalent bundle:

```bash
GITHUB_PAGES=true VITE_DEPLOYMENT_TARGET=github npm run build
```
