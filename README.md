# PodLearn AI

Turn any content into an engaging two-host podcast conversation — powered by Nvidia NIM (Llama 3 70B) for script generation and ElevenLabs for lifelike voices.

Paste a URL or text, choose your podcast style and tone, and within 60–90 seconds you get a natural back-and-forth conversation between two AI hosts (Jamie & Alex) you can listen to, interact with, and ask questions about.

---

## Features

- **Instant Podcast Generation** — Paste any URL or text content. The AI produces a multi-turn conversational script between two distinct hosts.
- **ElevenLabs Voices** — Professional, expressive TTS via the ElevenLabs API. Host A (Jamie) and Host B (Alex) have separate voice profiles for a natural dialogue feel.
- **Interactive Q&A (Raise Hand)** — Press **R** or tap ✋ while playing to pause the podcast and ask a question. The hosts answer with a spoken audio response and then resume where they left off.
- **Background Playback** — Navigate away from the player (to Generate or Library) and audio keeps playing with a persistent mini-player bar at the bottom of the screen.
- **Closed Captions** — Toggle CC to see word-level karaoke-style captions synced to audio playback.
- **Live Transcript** — Full scrolling transcript with the active turn highlighted as the audio plays.
- **Podcast Library** — Every generated podcast is saved per-user. Browse, play, or delete past sessions from the library.
- **Style & Tone Controls** — Choose Casual / Technical / Storytelling style and Friendly / Professional / Humorous / Serious tone.
- **Clerk Authentication** — Secure sign-up, sign-in, and user sessions. Each user only sees their own library.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7, Tailwind CSS, shadcn/ui |
| Backend API | Express 5 (TypeScript), Clerk auth middleware |
| AI / LLM | Nvidia NIM API — `meta/llama3-70b-instruct` (OpenAI-compatible SDK) |
| TTS | ElevenLabs `eleven_turbo_v2_5` via Python/Flask proxy |
| Database | Supabase (PostgreSQL via `@supabase/supabase-js`) |
| Auth | Clerk (React + Express middleware) |
| Monorepo | pnpm workspaces |
| API Contract | OpenAPI 3.0 → Orval codegen → Zod schemas + React Query hooks |

---

## Project Structure

```
podlearn-ai/
├── artifacts/
│   ├── api-server/          # Express 5 API (TypeScript, esbuild)
│   │   └── src/
│   │       ├── app.ts       # Express app + Clerk middleware
│   │       ├── index.ts     # Server entrypoint
│   │       ├── routes/
│   │       │   └── sessions.ts   # All podcast session routes
│   │       ├── middlewares/
│   │       │   └── clerkProxyMiddleware.ts
│   │       └── lib/
│   │           ├── openai.ts     # Nvidia NIM client (OpenAI-compatible)
│   │           └── logger.ts
│   └── podlearn-ai/         # React + Vite frontend
│       └── src/
│           ├── App.tsx      # Router + Clerk + React Query providers
│           └── pages/
│               ├── home.tsx     # Main app (Generate / Library / Player)
│               └── landing.tsx  # Public landing page
├── lib/
│   ├── api-spec/            # OpenAPI 3.0 spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   └── db/                  # Supabase client + schema definitions
├── tts-server/
│   └── server.py            # Flask TTS proxy — calls ElevenLabs API
├── pnpm-workspace.yaml
├── preinstall.mjs           # Cross-platform pnpm enforcement
├── tsconfig.base.json       # Shared TypeScript config
├── tsconfig.json            # Root project references
└── package.json
```

---

## API Routes

All routes under `/api/` require Clerk authentication except `/api/healthz`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check (public) |
| `GET` | `/api/sessions` | List user's podcast sessions |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions/:id` | Get session details |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `POST` | `/api/sessions/:id/upload` | Upload content (URL or text) |
| `POST` | `/api/sessions/:id/generate` | Generate podcast script + audio |
| `POST` | `/api/sessions/:id/ask` | Ask a Q&A question |
| `GET` | `/api/sessions/:id/audio/:file` | Stream audio file |

---

## Database Schema

**`podcast_sessions`** table (Supabase / PostgreSQL):

| Column | Type | Description |
|---|---|---|
| `id` | text PK | UUID session ID |
| `user_id` | text | Clerk user ID |
| `title` | text | Auto-generated title |
| `status` | text | `idle` / `processing` / `ready` / `error` |
| `content_type` | text | `url` / `text` |
| `content_preview` | text | Truncated preview of source |
| `content_chunks` | jsonb | Chunked content for RAG |
| `podcast_style` | text | `casual` / `technical` / `storytelling` |
| `podcast_tone` | text | `friendly` / `professional` / `humorous` / `serious` |
| `script` | jsonb | Array of `{ host, text }` dialogue turns |
| `audio_filename` | text | Filename of the generated podcast MP3 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Yes | Nvidia NIM base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Yes | Nvidia NIM API key |
| `CLERK_SECRET_KEY` | Yes | Clerk server-side secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk client-side publishable key |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key |
| `PORT` | Auto | Assigned per service by Replit |

---

## Running Locally

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | 24 recommended |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.10+ | For the TTS server |

You will also need accounts and API keys for:
- [Supabase](https://supabase.com) — create a project and grab the URL + service role key
- [Clerk](https://clerk.com) — create an application and grab the publishable + secret keys
- [ElevenLabs](https://elevenlabs.io) — grab your API key from the dashboard
- [Nvidia NIM](https://build.nvidia.com) — grab an API key for `meta/llama3-70b-instruct`

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/podlearn-ai.git
cd podlearn-ai
```

---

### 2. Set environment variables

Create a `.env` file in the project root (or export these in your shell). The API server and TTS server read from environment variables directly.

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Nvidia NIM (OpenAI-compatible endpoint)
AI_INTEGRATIONS_OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=your-nvidia-nim-api-key

# Clerk — server side
CLERK_SECRET_KEY=sk_live_...

# Clerk — client side (used by Vite)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# ElevenLabs
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

> **Note:** The frontend reads `VITE_CLERK_PUBLISHABLE_KEY` at build time via Vite's `import.meta.env`. If you use a `.env` file, Vite will pick it up automatically from the project root.

---

### 3. Install dependencies

```bash
# Install all Node.js workspace dependencies
pnpm install

# Install Python dependencies for the TTS server
pip install flask requests
```

---

### 4. Create the database table

Run the following SQL in your Supabase SQL editor (or any Postgres client connected to your project):

```sql
CREATE TABLE IF NOT EXISTS podcast_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  content_type TEXT,
  content_preview TEXT,
  content_chunks JSONB,
  podcast_style TEXT,
  podcast_tone TEXT,
  podcast_accent TEXT,
  podcast_length TEXT,
  script JSONB,
  script_turns INTEGER,
  audio_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 5. Start all three services

Open three terminal windows (or use a process manager like `tmux`):

**Terminal 1 — TTS Server (Flask, port 5001)**
```bash
python tts-server/server.py
```

**Terminal 2 — API Server (Express, port 8080)**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 3 — Frontend (Vite)**
```bash
pnpm --filter @workspace/podlearn-ai run dev
```

The frontend dev server will print the local URL (typically `http://localhost:5173` or the port Vite picks). Open it in your browser to use the app.

---

### Optional: Regenerate API client

If you change `lib/api-spec/openapi.yaml`, regenerate the Zod schemas and React Query hooks:

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Optional: Build all packages

```bash
pnpm run build
```

---

## How It Works

1. **User pastes content** — URL or text is uploaded and chunked for RAG.
2. **Script generation** — Llama 3 70B generates a multi-turn dialogue script between Jamie (Host A) and Alex (Host B), tailored to the chosen style and tone.
3. **Audio synthesis** — Each dialogue turn is sent to the ElevenLabs API in parallel. The resulting audio chunks are concatenated into a single MP3.
4. **Playback** — The frontend fetches the audio with a Bearer token, creates a Blob URL, and plays it through an `<audio>` element. The `PlayerPage` stays mounted even when navigating away, enabling background playback.
5. **Q&A** — Questions are answered using the stored content chunks as context (RAG). Answers are spoken using the same TTS pipeline and played back through a secondary audio element.

---

## Audio Storage

Generated podcast and answer MP3 files are stored at `artifacts/audio/` (resolved from the workspace root at runtime). Files are served through the authenticated `/api/sessions/:id/audio/:filename` endpoint. The `artifacts/audio/` directory is excluded from version control.
