# PodLearn AI

Turn any content into an engaging two-host podcast conversation — powered by Nvidia NIM (Llama 3 70B) for script generation and ElevenLabs for lifelike voices.

Paste a URL or text, choose your podcast style and tone, and within 60–90 seconds you get a natural back-and-forth conversation between two AI hosts (Jamie & Alex) you can listen to, interact with, and ask questions about.

---

## Features

- **Instant Podcast Generation** — Paste any URL or text content. The AI produces a multi-turn conversational script between two distinct hosts.
- **ElevenLabs Voices** — Professional, expressive TTS via the ElevenLabs API. Host A (Jamie) and Host B (Alex) have separate voice profiles for a natural dialogue feel.
- **Interactive Q&A** — Press **R** or tap ✋ while playing to pause and ask a question. The hosts answer with a spoken audio response and then resume where they left off.
- **Background Playback** — Navigate away from the player and audio keeps playing with a persistent mini-player bar.
- **Closed Captions** — Word-level karaoke-style captions synced to audio playback.
- **Live Transcript** — Full scrolling transcript with the active turn highlighted as the audio plays.
- **Podcast Library** — Every generated podcast is saved per-user. Browse, play, or delete past sessions.
- **Style & Tone Controls** — Casual / Technical / Storytelling style and Friendly / Professional / Humorous / Serious tone.
- **Clerk Authentication** — Secure sign-up, sign-in, and per-user library.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7, Tailwind CSS, shadcn/ui |
| Backend API | Express 5 (TypeScript), Clerk auth middleware |
| AI / LLM | Nvidia NIM — `meta/llama3-70b-instruct` |
| TTS | ElevenLabs `eleven_turbo_v2_5` via Python/Flask proxy |
| Database | Supabase (PostgreSQL) |
| Auth | Clerk |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
podlearn-ai/
├── artifacts/
│   ├── api-server/           # Express 5 API (TypeScript, esbuild)
│   │   └── src/
│   │       ├── app.ts
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── sessions.ts    # All podcast session routes
│   │       ├── middlewares/
│   │       │   └── clerkProxyMiddleware.ts
│   │       └── lib/
│   │           ├── openai.ts      # Nvidia NIM client
│   │           └── logger.ts
│   └── podlearn-ai/          # React + Vite frontend
│       └── src/
│           ├── App.tsx
│           └── pages/
│               ├── home.tsx       # Main app (Generate / Library / Player)
│               └── landing.tsx    # Public landing page
├── lib/
│   ├── api-client-react/     # React Query hooks (generated from OpenAPI spec)
│   ├── api-zod/              # Zod validation schemas (generated from OpenAPI spec)
│   └── db/                   # Supabase client + session schema
├── tts-server/
│   ├── server.py             # Flask TTS proxy — calls ElevenLabs API
│   └── requirements.txt
├── .env.example              # Copy to .env and fill in your keys
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

## Running Locally (Windows / Mac / Linux)

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.10+ | https://python.org |

You also need accounts and API keys for:
- [Supabase](https://supabase.com) — create a project, grab the URL + service role key
- [Clerk](https://clerk.com) — create an application, grab the publishable key + secret key
- [ElevenLabs](https://elevenlabs.io) — grab your API key from the dashboard
- [Nvidia NIM](https://build.nvidia.com) — create a free account, grab an API key (model: `meta/llama3-70b-instruct`)

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/podlearn-ai.git
cd podlearn-ai
```

---

### 2. Set environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
# Windows (Command Prompt)
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Then open `.env` and replace each placeholder with your real keys.

---

### 3. Create the Supabase table

Run this SQL once in your Supabase project's SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS podcast_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  content_type TEXT,
  content_preview TEXT,
  content_chunks JSONB,
  podcast_style TEXT,
  script_turns INTEGER,
  script JSONB,
  audio_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Also create the audio storage bucket in Supabase Storage named **`podcast-audio`** (public or private — the API uses the service role key to access it).

---

### 4. Install dependencies

```bash
# Node.js packages (all workspaces)
pnpm install

# Python packages (TTS server)
pip install -r tts-server/requirements.txt
```

---

### 5. Start all three services

Open **three separate terminals** from the project root:

**Terminal 1 — TTS Server** (port 5001)
```bash
python tts-server/server.py
```

**Terminal 2 — API Server** (port 8080)
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 3 — Frontend** (Vite, port 5173 or next available)
```bash
pnpm --filter @workspace/podlearn-ai run dev
```

Open the URL printed by Vite (e.g. `http://localhost:5173`) in your browser.

---

## How It Works

1. **Upload content** — A URL is fetched and chunked, or pasted text is chunked directly.
2. **Script generation** — Llama 3 70B generates a multi-turn dialogue between Jamie (Host A) and Alex (Host B), tailored to the chosen style and tone.
3. **Audio synthesis** — Each dialogue turn is sent to ElevenLabs. Audio chunks are stitched into a single MP3 and uploaded to Supabase Storage.
4. **Playback** — Audio is streamed through an authenticated API endpoint. The player stays mounted across navigation, enabling background playback.
5. **Q&A** — Questions are answered with the stored content chunks as context. Answers are synthesised via TTS and played back inline.

---

## Notes

- Generated audio files are stored locally in `artifacts/audio/` (gitignored) and backed up to Supabase Storage automatically on generation.
- Podcast generation takes 60–120 seconds depending on script length and ElevenLabs response time.
- The Nvidia NIM API key must have access to `meta/llama3-70b-instruct`.
