# PodLearn AI

Turn any content into an engaging two-host podcast conversation — powered by Nvidia NIM (Llama 3.3 70B) for script generation and ElevenLabs for lifelike voices.

Paste a URL or text, choose your podcast style and tone, and within 60–90 seconds you get a natural back-and-forth conversation between two AI hosts you can listen to, interact with, and ask questions about.

---

## Features

- **Instant Podcast Generation** — Paste any URL or text content. The AI produces a multi-turn conversational script between two distinct hosts.
- **ElevenLabs Voices** — Professional, expressive TTS via the ElevenLabs API. Host A and Host B have separate voice profiles for a natural dialogue feel. Voices are auto-discovered from your ElevenLabs account with fallback to Roger and Sarah.
- **Interactive Q&A** — Press **R** or tap ✋ while playing to pause and ask a question. The hosts answer with a spoken audio response and then resume where they left off.
- **Background Playback** — Navigate away from the player and audio keeps playing with a persistent mini-player bar.
- **Closed Captions** — Word-level karaoke-style captions synced to audio playback.
- **Live Transcript** — Full scrolling transcript with the active turn highlighted as the audio plays.
- **Podcast Library** — Every generated podcast is saved per-user. Browse, play, or delete past sessions.
- **Style & Tone Controls** — Casual / Technical / Storytelling style and Friendly / Professional / Humorous / Serious tone.
- **Clerk Authentication** — Secure sign-up, sign-in, and per-user library. Email/password supported on all deployments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7, Tailwind CSS, shadcn/ui |
| Backend API | Express 5 (TypeScript), Clerk auth middleware |
| AI / LLM | Nvidia NIM — `meta/llama-3.3-70b-instruct` |
| TTS | ElevenLabs `eleven_turbo_v2_5` via Python/Flask+Gunicorn proxy |
| Database | Supabase (PostgreSQL + Storage) |
| Auth | Clerk |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
podlearn-ai/
├── artifacts/
│   ├── api-server/           # Express 5 API (TypeScript, esbuild)
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── sessions.ts    # All podcast session routes
│   │   │   ├── middlewares/
│   │   │   │   └── clerkProxyMiddleware.ts
│   │   │   └── lib/
│   │   │       ├── openai.ts      # Nvidia NIM client
│   │   │       └── logger.ts
│   │   └── Dockerfile
│   └── podlearn-ai/          # React + Vite frontend
│       ├── src/
│       │   ├── App.tsx
│       │   └── pages/
│       │       ├── home.tsx       # Main app (Generate / Library / Player)
│       │       ├── landing.tsx    # Public landing page
│       │       └── not-found.tsx
│       └── index.html
├── lib/
│   ├── api-spec/             # OpenAPI spec + Orval codegen config
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas
│   └── db/                   # Supabase client + schema
├── tts-server/
│   ├── server.py             # Flask TTS proxy — calls ElevenLabs API
│   ├── requirements.txt
│   └── Dockerfile
├── vercel.json               # Vercel deployment config (SPA rewrites)
├── render.yaml               # Render deployment config (API + TTS)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## API Routes

All routes under `/api/` require Clerk authentication except `/api/healthz`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/sessions` | List user's sessions |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions/:id` | Get session details |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `POST` | `/api/sessions/:id/upload` | Upload content (URL or text) |
| `POST` | `/api/sessions/:id/generate` | Generate podcast script + audio |
| `POST` | `/api/sessions/:id/ask` | Ask a Q&A question |
| `GET` | `/api/sessions/:id/audio/:file` | Stream audio file |

---

## Deployment

### Architecture

```
Vercel (Frontend)  →  Render (API Server)  →  Render (TTS Server)
                              ↓
                         Supabase (DB + Storage)
```

### Deploy order: TTS Server first → API Server → Frontend

---

### Render — TTS Server (deploy first)

1. New Web Service → connect repo → **Docker** runtime
2. Set **Dockerfile path**: `tts-server/Dockerfile`
3. Set environment variable: `ELEVENLABS_API_KEY`
4. Copy the public URL once deployed (e.g. `https://podlearn-tts.onrender.com`)

---

### Render — API Server

1. New Web Service → connect repo → **Docker** runtime
2. Set **Dockerfile path**: `artifacts/api-server/Dockerfile`
3. Set environment variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `NVIDIA_API_KEY` | Your Nvidia NIM API key |
| `CLERK_SECRET_KEY` | Your Clerk secret key (`sk_...`) |
| `TTS_SERVER_URL` | URL of the TTS service deployed above |

> You can also use `render.yaml` in the repo root with Render's Blueprint feature to deploy both services at once.

---

### Vercel — Frontend

1. Connect your GitHub repo to Vercel
2. Framework preset: **Other** (Vercel reads `vercel.json` automatically)
3. Set environment variables:

| Variable | Value | Scope |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key (`pk_...`) | Production + Preview |
| `VITE_API_URL` | Your Render API server URL | Production + Preview |

4. Deploy — Vercel uses the `vercel.json` build command and output directory automatically

> **Important:** `VITE_` variables are baked into the bundle **at build time**. Always set them before deploying and trigger a fresh build (not just a redeploy) after changing them.

---

### Clerk — Production Notes

- Clerk **development instances** (`pk_test_`) only work reliably on `localhost`. For production deployments you need a **Clerk production instance** which requires a custom domain (`.vercel.app` is not accepted).
- **Google OAuth** on non-localhost URLs requires a Clerk production instance with a verified custom domain.
- For testing on a Vercel preview URL without a custom domain, use **email + password** login (Google OAuth is hidden by default in the app for this reason).
- To fully enable Google OAuth on a custom domain: create a Clerk production instance → verify domain → update `pk_live_` and `sk_live_` keys in Vercel and Render.

---

## How It Works

1. **Upload content** — A URL is fetched and chunked, or pasted text is chunked directly.
2. **Script generation** — Llama 3.3 70B generates a multi-turn dialogue between two hosts tailored to the chosen style and tone.
3. **Audio synthesis** — Each dialogue turn is sent to ElevenLabs (`eleven_turbo_v2_5`). Audio chunks are stitched into a single MP3 and uploaded to Supabase Storage.
4. **Playback** — Audio is streamed through an authenticated API endpoint. The player stays mounted across navigation, enabling background playback.
5. **Q&A** — Questions are answered with the stored content chunks as context. Answers are synthesised via TTS and played back inline.

---

## Architecture Notes

### Audio Auth Pattern
`<audio>` elements cannot attach Bearer tokens. The frontend fetches audio via `fetch()` with an `Authorization: Bearer` header, creates a Blob URL with `URL.createObjectURL()`, and sets it on the `<audio>` element via ref. Blob URLs are revoked on unmount and before replacement.

### Background Playback
The player page stays mounted (hidden via `display: none`) when the user navigates away. A mini-player bar renders at the bottom while audio is ready and the user is elsewhere.

### Audio Storage
Generated MP3s are stored locally at `AUDIO_DIR` AND uploaded to Supabase Storage (`podcast-audio` bucket). The audio serving endpoint tries local disk first, then falls back to Supabase — so audio survives container restarts in production.

### TTS Voice Discovery
The TTS server auto-discovers available voices from your ElevenLabs account on startup. Override with `EL_VOICE_A` / `EL_VOICE_B` env vars. Free-tier fallback voice IDs: Roger (`CwhRBWXzGAHq8TQ4Fs17`) and Sarah (`EXAVITQu4vr4xnSDxMaL`).

### API Codegen
The OpenAPI spec lives in `lib/api-spec/openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate Zod schemas and React Query hooks after spec changes.

---

## Notes

- Podcast generation takes 60–120 seconds depending on script length and ElevenLabs response time.
- Generated audio is stored locally in `artifacts/audio/` (gitignored) and automatically backed up to Supabase Storage.
- The Nvidia NIM API key must have access to `meta/llama-3.3-70b-instruct`.
- ElevenLabs free tier voices are limited — the server auto-discovers whichever voices are available on your account.
