# PodLearn AI — Workspace

## Overview

pnpm monorepo powering PodLearn AI — a full-stack application that converts any content (URLs, text) into AI-generated two-host podcast conversations with interactive Q&A, live transcript, closed captions, and background playback.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **Package manager**: pnpm
- **TypeScript**: 5.9
- **Frontend**: React 19 + Vite 7, Tailwind CSS, shadcn/ui
- **API server**: Express 5 (TypeScript, esbuild bundle)
- **Database**: Supabase (PostgreSQL via `@supabase/supabase-js`)
- **AI / LLM**: Nvidia NIM API — `meta/llama3-70b-instruct` (OpenAI-compatible SDK)
- **TTS**: ElevenLabs `eleven_turbo_v2_5` via Python/Flask proxy (port 5001)
- **Auth**: Clerk (React + Express middleware)
- **API contract**: OpenAPI 3.0 → Orval → Zod schemas + React Query hooks

## Structure

```text
podlearn-ai/
├── artifacts/
│   ├── api-server/          # Express 5 API server (port 8080)
│   │   └── src/
│   │       ├── app.ts
│   │       ├── index.ts
│   │       ├── routes/sessions.ts
│   │       ├── middlewares/clerkProxyMiddleware.ts
│   │       └── lib/{openai,logger}.ts
│   └── podlearn-ai/         # React + Vite frontend (port 25829)
│       └── src/
│           ├── App.tsx
│           └── pages/{home,landing,not-found}.tsx
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Supabase client + schema
├── tts-server/server.py     # Flask ElevenLabs TTS proxy (port 5001)
├── pnpm-workspace.yaml
├── preinstall.mjs           # Cross-platform pnpm enforcement
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Services

| Service | Workflow | Port |
|---|---|---|
| Frontend (Vite) | `artifacts/podlearn-ai: web` | 25829 |
| API Server (Express) | `artifacts/api-server: API Server` | 8080 |
| TTS Server (Flask) | `tts-server: TTS Server` | 5001 |

## Environment Variables

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase connection
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Nvidia NIM API
- `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `ELEVENLABS_API_KEY` — ElevenLabs TTS
- `PORT` — auto-assigned per service

## Key Architecture Notes

### Audio Auth Pattern
`<audio>` elements cannot attach Bearer tokens. The frontend fetches audio via JS `fetch()` with `Authorization: Bearer <token>`, creates a Blob URL with `URL.createObjectURL()`, and sets it on the `<audio>` element imperatively via ref. Blob URLs are revoked on unmount and before replacement. All `.play()` calls use `.catch(() => {})` to handle browser autoplay policy.

### Background Playback
`PlayerPage` is kept mounted (hidden via `display: none`) when the user navigates away. Play state, current time, and duration are reported upward to `Home` via callbacks. A `MiniPlayer` bar renders at the bottom when audio is ready and the user is not on the player view.

### Audio Storage
Generated MP3s are stored at `artifacts/audio/` (resolved relative to workspace root). Served via authenticated `GET /api/sessions/:id/audio/:filename`. This directory is gitignored.

### API Codegen
The OpenAPI spec lives in `lib/api-spec/openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate Zod schemas and React Query hooks after spec changes.

## Root Scripts

- `pnpm run build` — typecheck then build all packages
- `pnpm run typecheck` — run `tsc --build` across all project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client
