import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, supabase } from "@workspace/db";
import {
  ListSessionsResponse,
  GetSessionResponse,
  GetSessionParams,
  DeleteSessionParams,
  UploadContentBody,
  UploadContentParams,
  UploadContentResponse,
  GeneratePodcastParams,
  GeneratePodcastBody,
  GeneratePodcastResponse,
  AskQuestionParams,
  AskQuestionBody,
  AskQuestionResponse,
} from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TTS_BASE_URL = (process.env.TTS_SERVER_URL ?? "http://localhost:5001").replace(/\/+$/, "");
const AUDIO_DIR = path.join(__dirname, "..", "..", "audio");

await mkdir(AUDIO_DIR, { recursive: true });

const STORAGE_BUCKET = "podcast-audio";
// Ensure the bucket exists — ignore "already exists" errors
try {
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
  });
  if (error && !error.message.includes("already exists")) {
    console.warn("[storage] Bucket create warning:", error.message);
  } else if (!error) {
    console.log("[storage] Created bucket:", STORAGE_BUCKET);
  }
} catch (e: any) {
  console.warn("[storage] Bucket init error:", e?.message ?? e);
}

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId as string;
  next();
}

// On startup, reset any sessions stuck in "processing"
try {
  const count = await db.resetStuckSessions();
  if (count > 0) {
    console.log(`[startup] Reset ${count} stuck processing session(s) to error`);
  }
} catch (e) {
  console.error("[startup] DB check failed:", (e as Error).message);
}


async function fetchUrlContent(url: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const { load } = await import("cheerio");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const html = await response.text();

  if (!contentType.includes("text/html")) {
    return html.replace(/\s+/g, " ").trim();
  }

  const $ = load(html);

  // Remove noise elements
  $("script, style, nav, footer, header, aside, .ads, .advertisement, noscript, iframe, [aria-hidden='true']").remove();
  $("[class*='cookie'], [class*='popup'], [class*='modal'], [class*='banner'], [id*='cookie'], [id*='popup']").remove();

  // Try structured content selectors first (best quality)
  const structured = $("article, [role='main'], main, .article-body, .post-content, .entry-content, .article-content, .story-body, #article-body, #main-content").first().text();
  if (structured.replace(/\s+/g, " ").trim().length > 200) {
    return structured.replace(/\s+/g, " ").trim();
  }

  // Fallback: grab all paragraph text
  const paragraphs: string[] = [];
  $("p, h1, h2, h3, h4, li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 20) paragraphs.push(t);
  });
  if (paragraphs.length > 0) {
    const joined = paragraphs.join(" ");
    if (joined.length > 200) return joined;
  }

  // Last resort: full body text
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length > 100) return bodyText;

  throw new Error("This URL doesn't contain enough readable text. It may require JavaScript to load (try pasting the text content directly instead).");
}

function chunkText(text: string, chunkSize = 1500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
}

interface PodcastOptions {
  style?: string;
  tone?: string;
  accent?: string;
  length?: string;
  title?: string;
}

async function generatePodcastScript(
  chunks: string[],
  options: PodcastOptions = {}
): Promise<{ host: string; text: string }[]> {
  const { style = "casual", tone = "friendly", accent = "american", length = "descriptive", title = "this topic" } = options;
  const context = chunks.slice(0, 5).join("\n\n");

  const styleGuide: Record<string, string> = {
    casual: "Casual and fun — like two friends chatting over coffee. Include natural filler words (hmm, oh wow, right, exactly, yeah), light humor, and relatable everyday analogies.",
    technical: "Precise and deep — two technical minds diving into details. Host A is learning fast, Host B is rigorous but never dry. Include the terminology but always explain it.",
    storytelling: "Narrative and immersive — weave the content into a story arc. Use suspense, vivid imagery, and emotional moments. Host A reacts emotionally, Host B is the master storyteller.",
  };

  const toneGuide: Record<string, string> = {
    friendly: "Warm, approachable, and encouraging. The hosts feel like good friends you trust.",
    professional: "Polished and authoritative, but never stiff. Clear, confident, measured delivery.",
    humorous: "Genuinely funny and witty — include clever jokes, playful teasing between hosts, and comic timing. Keep it smart, not silly.",
    serious: "Earnest and thoughtful. The hosts treat the topic with gravity and depth, pausing to reflect.",
  };

  const accentGuide: Record<string, string> = {
    american: "Both hosts use American English idioms and speech patterns.",
    british: "Both hosts use British English expressions, phrases like 'brilliant', 'quite right', 'I reckon', 'cheers'.",
    australian: "Both hosts use Australian English expressions, phrases like 'no worries', 'fair dinkum', 'reckon', 'arvo'.",
    neutral: "Both hosts use clear, accent-neutral international English — accessible to global listeners.",
  };

  const hostNames = { A: "Jamie", B: "Alex" };

  const turnRange = length === "concise" ? "10-14 turns" : "20-26 turns";
  const depthGuide = length === "concise"
    ? "Be focused and efficient — hit the key points with impact. Every turn counts, so don't linger."
    : "Be thorough and exploratory — go deep on ideas, use extended analogies, circle back to earlier points, and let the conversation breathe.";

  const systemPrompt = `You are an expert podcast script writer for a show called PodLearn AI.

Write a two-host conversational podcast script that will be read aloud by text-to-speech voices — so it must sound EXACTLY like natural spoken conversation.

HOST CHARACTERS:
Host A (${hostNames.A}): Curious, slightly nervous energy. Represents the eager learner. Reacts authentically — surprised, excited, confused, delighted.
Host B (${hostNames.B}): Warm and engaging expert. Makes complex things accessible through stories, vivid analogies, and genuine enthusiasm. Never lectures.

STYLE DIRECTION: ${styleGuide[style] || styleGuide.casual}
TONE: ${toneGuide[tone] || toneGuide.friendly}
ACCENT & DIALECT: ${accentGuide[accent] || accentGuide.american}
LENGTH: ${turnRange}. ${depthGuide}

OPENING: The FIRST turn (Host A) must be a natural welcome that introduces the show and teases the topic ("${title}") — like a real podcast cold open. Keep it energetic and brief. Host B then riffs on that intro and sets up the discussion.

CONTENT GROUNDING — THIS IS THE MOST IMPORTANT RULE:
The conversation must be based EXCLUSIVELY on the reference material provided by the user. You must:
- Only discuss facts, ideas, examples, statistics, and claims that appear in the provided content
- Never introduce outside knowledge, additional context, or information not present in the source material
- Never invent examples, analogies, or scenarios that go beyond what the source material describes
- If the source material uses a specific analogy or example, you may use it — but do not create new ones from your own knowledge
- The hosts may react to and explore what is IN the content, but cannot add to it
- If a topic is only briefly mentioned in the source, keep the coverage proportionally brief — do not expand it with external knowledge
- Treat the provided content as the complete and only source of truth

CRITICAL — this script will be read by TTS voices and must sound like REAL SPEECH:
- Write exactly how people TALK, not how they write. Use contractions always: "it's", "you'd", "we're", "isn't"
- Sentence variety is essential: one-word reactions ("Exactly."), fragments ("Which is wild."), and longer flowing thoughts
- Natural back-and-forth: each turn should feel like a genuine response to what was just said
- Thinking pauses via punctuation only — em-dashes for cut-off thoughts ("well, that's — actually that changes things"), ellipses for trailing off ("so you'd think... but no")
- Authentic reactions scattered naturally: "Huh.", "Oh that's interesting.", "Wait — really?", "Right, right.", "I hadn't thought of it that way."
- Self-corrections and hedges: "Well, sort of — it's more like...", "I mean, technically speaking...", "Not exactly, but kind of..."
- NO bullet points, numbered lists, headers, or any written-document structure — only natural flowing speech
- NEVER start consecutive turns with the same word or phrase
- Write emphasis by word choice and position, not ALL CAPS or asterisks

Output ONLY a valid JSON array: [{"host": "A", "text": "..."}, {"host": "B", "text": "..."}]
No markdown, no preamble, no explanation — just the raw JSON array.`;

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Create a compelling, natural-sounding podcast conversation based ONLY on the following reference material. Do not introduce any facts, examples, or information from outside this text:\n\n${context}`,
    },
  ];

  console.log(`[generate] Context: ${context.length} chars, ${chunks.length} chunk(s). System prompt: ${systemPrompt.length} chars.`);

  let raw = "[]";
  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "meta/llama-3.3-70b-instruct",
        max_tokens: 4096,
        messages,
      });
      raw = response.choices[0]?.message?.content || "[]";
      console.log(`[generate] LLM raw response (first 300 chars): ${raw.slice(0, 300)}`);
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      console.error(`[generate] LLM attempt ${attempt}/3 failed:`, e?.message, "status:", e?.status, "body:", JSON.stringify(e?.error));
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  if (lastErr) throw lastErr;

  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[generate] No JSON array found in raw response: ${cleaned.slice(0, 500)}`);
      throw new Error("No JSON array found");
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty or invalid array");
    return parsed;
  } catch (e: any) {
    console.error(`[generate] JSON parse failed: ${e?.message}. Raw: ${raw.slice(0, 300)}`);
    return [{ host: "A", text: "I couldn't generate the script. Please try again." }];
  }
}

interface TtsResult {
  audio: Buffer;
  chars: string[];
  charStarts: number[];
  charEnds: number[];
}

async function ttsForHost(text: string, host: string, accent: string = "american"): Promise<TtsResult> {
  const { default: fetch } = await import("node-fetch");
  const response = await fetch(`${TTS_BASE_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, host, accent }),
  });
  if (!response.ok) {
    let errBody = "(no body)";
    try { errBody = await response.text(); } catch {}
    console.error(`[tts] HTTP ${response.status} from TTS server: ${errBody}`);
    throw new Error(`TTS failed: ${response.status} — ${errBody}`);
  }
  const json = await response.json() as any;
  const audio = Buffer.from(json.audio_base64, "base64");
  return {
    audio,
    chars: json.chars ?? [],
    charStarts: json.char_starts ?? [],
    charEnds: json.char_ends ?? [],
  };
}

interface WordTiming {
  word: string;
  start: number;
  end: number;
  turnIndex: number;
}

/** Convert character-level timestamps to word-level timestamps with a global time offset */
function charsToWordTimings(
  text: string,
  chars: string[],
  charStarts: number[],
  charEnds: number[],
  turnIndex: number,
  offset: number
): WordTiming[] {
  if (!chars.length) return [];
  const timings: WordTiming[] = [];
  // Reconstruct the full string from the chars array to find word boundaries
  let charIdx = 0;
  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const wordStart = match.index;
    const wordEnd = wordStart + word.length;
    // Map word start/end to character array indices
    // The chars array includes whitespace so we need to walk it
    let ci = charIdx;
    // Skip whitespace to reach word start character in chars
    while (ci < chars.length && charStarts[ci] < (charStarts[charIdx] || 0) + 0.001 && chars[ci].trim() === "") ci++;
    // Find char array index matching word start position
    // Use the proportion: walk ci until we've matched the word characters
    let wordCharStart = ci;
    let matched = 0;
    while (ci < chars.length && matched < word.length) {
      if (chars[ci].trim() !== "" || matched > 0) matched++;
      ci++;
    }
    const wordCharEnd = ci - 1;
    const startTime = (charStarts[wordCharStart] ?? 0) + offset;
    const endTime = (charEnds[wordCharEnd] ?? charStarts[wordCharStart] ?? 0) + offset;
    timings.push({ word, start: startTime, end: endTime, turnIndex });
    charIdx = ci;
    // Skip whitespace
    while (charIdx < chars.length && chars[charIdx].trim() === "") charIdx++;
  }
  return timings;
}

async function generateTitle(content: string): Promise<string> {
  try {
    const preview = content.slice(0, 3000);
    const response = await openai.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content: `You generate compelling, specific podcast episode titles. 
Rules:
- 4–8 words maximum
- Specific and descriptive — capture the actual topic, not generic phrases
- Podcast-episode style: punchy, intriguing, uses title case
- NO quotes, NO colons, NO "The", NO "A" as first word
- Examples of good titles: "Inside the Mind of a Black Hole", "How Sleep Rewires Your Memory", "Why Empires Always Fall the Same Way"
Return ONLY the title — no punctuation at the end, no explanation.`,
        },
        {
          role: "user",
          content: `Generate a podcast episode title for content that begins:\n\n${preview}`,
        },
      ],
    });
    const title = response.choices[0]?.message?.content?.trim() ?? "";
    return title.length > 5 ? title : "";
  } catch {
    return "";
  }
}

async function generateAudio(
  script: { host: string; text: string }[],
  sessionId: string,
  accent: string = "american",
): Promise<string> {
  const audioSegments: Buffer[] = [];

  for (let i = 0; i < script.length; i++) {
    const turn = script[i];
    console.log(`[audio] Turn ${i + 1}/${script.length} [Host ${turn.host}]: "${turn.text.slice(0, 50)}..."`);
    const buf = await ttsForHost(turn.text, turn.host, accent);
    audioSegments.push(buf.audio);
  }

  const combined = Buffer.concat(audioSegments);
  const filename = `${sessionId}-podcast.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);
  await writeFile(filePath, combined);

  // Upload to Supabase Storage so audio works from any machine (local dev, etc.)
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, combined, { contentType: "audio/mpeg", upsert: true });
    if (error) {
      console.warn("[storage] Upload failed:", error.message);
    } else {
      console.log("[storage] Uploaded:", filename);
    }
  } catch (e: any) {
    console.warn("[storage] Upload error:", e?.message ?? e);
  }

  return filename;
}

router.get("/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const sessions = await db.listSessions(userId);

  res.json(ListSessionsResponse.parse(sessions.map((s: any) => ({
    id: s.id,
    title: s.title,
    status: s.status as "idle" | "processing" | "ready" | "error",
    contentType: s.contentType as "url" | "text" | "pdf" | null,
    contentPreview: s.contentPreview,
    podcastStyle: s.podcastStyle as "casual" | "technical" | "storytelling" | null,
    podcastAccent: s.podcastAccent ?? null,
    scriptTurns: s.scriptTurns,
    audioUrl: s.audioFilename ? `/api/sessions/${s.id}/audio/${s.audioFilename}` : null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))));
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = randomUUID();
  const session = await db.createSession({ id, userId, status: "idle" });

  res.status(201).json({
    id: session.id,
    title: session.title,
    status: session.status,
    contentType: session.contentType,
    contentPreview: session.contentPreview,
    podcastStyle: session.podcastStyle,
    scriptTurns: session.scriptTurns,
    audioUrl: null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
});

router.get("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSessionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db.getSession(params.data.id, userId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(GetSessionResponse.parse({
    id: session.id,
    title: session.title,
    status: session.status,
    contentType: session.contentType,
    contentPreview: session.contentPreview,
    podcastStyle: session.podcastStyle,
    podcastAccent: session.podcastAccent ?? null,
    scriptTurns: session.scriptTurns,
    audioUrl: session.audioFilename ? `/api/sessions/${session.id}/audio/${session.audioFilename}` : null,
    script: session.script ?? undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
});

router.delete("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSessionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.deleteSession(params.data.id, userId);
  res.sendStatus(204);
});

router.post("/sessions/:id/upload", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UploadContentParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UploadContentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = (req as any).userId;
  const existingSession = await db.getSession(params.data.id, userId);

  if (!existingSession) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  let content = "";
  const contentType: "url" | "text" = body.data.type;

  try {
    if (body.data.type === "url") {
      content = await fetchUrlContent(body.data.content);
    } else {
      content = body.data.content;
    }
  } catch (err: any) {
    res.status(400).json({ error: `Failed to process content: ${err.message}` });
    return;
  }

  if (!content || content.length < 50) {
    res.status(400).json({ error: "Content is too short or empty. Please provide more substantial content." });
    return;
  }

  const [chunks, aiTitle] = await Promise.all([
    Promise.resolve(chunkText(content)),
    generateTitle(content),
  ]);
  const contentPreview = content.slice(0, 300) + (content.length > 300 ? "..." : "");
  const title = aiTitle || body.data.title || (body.data.type === "url"
    ? new URL(body.data.content).hostname
    : content.slice(0, 80).trim());

  await db.updateSession(params.data.id, {
    title,
    contentType,
    contentPreview,
    contentChunks: chunks,
    status: "idle",
    updatedAt: new Date(),
  });

  res.json(UploadContentResponse.parse({
    sessionId: params.data.id,
    contentPreview,
    chunkCount: chunks.length,
    message: `Successfully processed content into ${chunks.length} chunks.`,
  }));
});

router.post("/sessions/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GeneratePodcastParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GeneratePodcastBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = (req as any).userId;
  const session = await db.getSession(params.data.id, userId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const chunks = (session.contentChunks as string[]) || [];
  if (chunks.length === 0) {
    res.status(400).json({ error: "No content to generate podcast from. Please upload content first." });
    return;
  }

  const style = body.data.style || "casual";
  const tone = body.data.tone || "friendly";
  const accent = body.data.accent || "american";
  const length = body.data.length || "descriptive";
  const title = session.title || "today's topic";
  const sessionId = params.data.id;

  await db.updateSession(sessionId, { status: "processing", updatedAt: new Date() });

  res.json(GeneratePodcastResponse.parse({
    sessionId,
    message: "Podcast generation started. Poll the session for status updates.",
  }));

  setImmediate(async () => {
    try {
      console.log(`[generate] Starting script generation for session ${sessionId}`);
      const script = await generatePodcastScript(chunks, { style, tone, accent, length, title });
      console.log(`[generate] Script done: ${script.length} turns. Starting audio...`);
      const filename = await generateAudio(script, sessionId, accent);
      console.log(`[generate] Audio done: ${filename}`);

      await db.updateSession(sessionId, {
        status: "ready",
        podcastStyle: style,
        podcastAccent: accent,
        script,
        scriptTurns: script.length,
        audioFilename: filename,
        updatedAt: new Date(),
      });
      console.log(`[generate] Session ${sessionId} marked ready`);
    } catch (err: any) {
      console.error(`[generate] FAILED for session ${sessionId}:`, err?.message ?? err);
      console.error(`[generate] Error details:`, JSON.stringify({
        status: err?.status,
        code: err?.code,
        error: err?.error,
        headers: err?.headers,
      }));
      await db.updateSession(sessionId, { status: "error", updatedAt: new Date() });
    }
  });
});

router.get("/sessions/:id/audio/:filename", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawFilename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;

  if (!rawId || !rawFilename) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const session = await db.getSession(rawId, userId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const safeName = path.basename(rawFilename);
  const filePath = path.join(AUDIO_DIR, safeName);
  const contentType = safeName.endsWith(".wav") ? "audio/wav" : "audio/mpeg";

  // Try local filesystem first (fast path for same-machine access)
  try {
    const buffer = await readFile(filePath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buffer);
    return;
  } catch {
    // Not on local disk — fall through to Supabase Storage
  }

  // Fallback: Supabase Storage (works on any machine / local dev)
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(safeName);
    if (error || !data) {
      res.status(404).json({ error: "Audio file not found" });
      return;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buffer);
  } catch (e: any) {
    console.error("[storage] Download error:", e?.message ?? e);
    res.status(404).json({ error: "Audio file not found" });
  }
});

router.post("/sessions/:id/ask", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AskQuestionParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AskQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const session = await db.getSession(params.data.id, userId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const chunks = (session.contentChunks as string[]) || [];
  if (chunks.length === 0) {
    res.status(400).json({ error: "No content available for Q&A." });
    return;
  }

  const relevantChunks = chunks.slice(0, 3);
  const context = relevantChunks.join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "meta/llama-3.3-70b-instruct",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are two podcast hosts — Jamie (Host A) and Alex (Host B) — answering a listener question live on air.

STRICT GROUNDING RULE: You must answer ONLY from the context provided below. Do not use any outside knowledge, facts, or information not present in that context. Every claim in your answer must be traceable to the provided context.

When a listener asks a question:
- Open with a warm, natural reaction: "Great question!", "Oh, interesting!", "I was wondering about that too!", etc.
- Jamie (Host A) starts with an initial reaction and sets up the answer
- Alex (Host B) dives deeper with context, explanation, or details — drawn ONLY from the provided text
- Keep it conversational and podcast-like — no bullet points, no numbered lists
- 3–5 sentences total, split naturally between the two hosts
- If the answer is not covered in the context, say so honestly: "Hmm, that's a good one — we didn't actually cover that in our material today." Do not speculate, guess, or introduce external knowledge.

Format your response as natural flowing dialogue without speaker labels — just write it as if you're hearing two people talk.`,
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nListener question: "${body.data.question}"`,
      },
    ],
  });

  const answer = response.choices[0]?.message?.content || "Great question! We'd need a bit more context to answer that fully, but based on what we've covered — that's definitely something worth exploring further.";

  let answerAudioUrl: string | null = null;
  try {
    const ttsResult = await ttsForHost(answer, "A");
    const audioFilename = `${params.data.id}-answer-${Date.now()}.mp3`;
    await writeFile(path.join(AUDIO_DIR, audioFilename), ttsResult.audio);
    answerAudioUrl = `/api/sessions/${params.data.id}/audio/${audioFilename}`;
  } catch (e) {
    console.error("[ask] TTS failed:", e);
  }

  res.json(AskQuestionResponse.parse({
    question: body.data.question,
    answer,
    answerAudioUrl,
    relevantChunks,
  }));
});

export default router;
