import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCreateSession,
  useUploadContent,
  useGeneratePodcast,
  useGetSession,
  useListSessions,
  useAskQuestion,
} from "@workspace/api-client-react";
import type {
  PodcastSession,
  DialogueTurn,
} from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Headphones,
  Zap,
  BookOpen,
  Play,
  Pause,
  SkipBack,
  FastForward,
  Search,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Check,
  Mic,
  X,
  Hand,
  Volume2,
  Trash2,
  Download,
  LogOut,
  User,
  MessageSquare,
  Ellipsis,
} from "lucide-react";

type View = "generate" | "library" | "player";
type StyleOption = "casual" | "technical" | "storytelling";
type ToneOption = "friendly" | "professional" | "humorous" | "serious";
type AccentOption = "american" | "british" | "australian" | "neutral";
type LengthOption = "concise" | "descriptive";

export default function Home() {
  const [view, setView] = useState<View>("generate");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<DialogueTurn[] | null>(null);

  const playerRef = useRef<PlayerHandle>(null);
  const [bgIsPlaying, setBgIsPlaying] = useState(false);
  const [bgCurrentTime, setBgCurrentTime] = useState(0);
  const [bgDuration, setBgDuration] = useState(0);
  const [bgAudioReady, setBgAudioReady] = useState(false);

  const handleSessionReady = (id: string, script?: DialogueTurn[]) => {
    if (id !== activeSessionId) {
      setBgIsPlaying(false);
      setBgCurrentTime(0);
      setBgDuration(0);
      setBgAudioReady(false);
    }
    setActiveSessionId(id);
    if (script) setTranscript(script);
    setView("player");
  };

  const handlePlayFromLibrary = (id: string) => {
    if (id !== activeSessionId) {
      setBgIsPlaying(false);
      setBgCurrentTime(0);
      setBgDuration(0);
      setBgAudioReady(false);
    }
    setActiveSessionId(id);
    setTranscript(null);
    setView("player");
  };

  const showMiniPlayer = view !== "player" && !!activeSessionId && bgAudioReady;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar view={view} onViewChange={setView} />
      <main className={`flex-1 overflow-auto${showMiniPlayer ? " pb-16" : ""}`}>
        {view === "generate" && (
          <GeneratePage onSessionReady={handleSessionReady} />
        )}
        {view === "library" && (
          <LibraryPage onPlay={handlePlayFromLibrary} />
        )}
        <div style={{ display: view === "player" ? undefined : "none" }}>
          {activeSessionId && (
            <PlayerPage
              ref={playerRef}
              sessionId={activeSessionId}
              transcript={transcript}
              onBack={() => setView("library")}
              onPlayStateChange={setBgIsPlaying}
              onTimeUpdate={(ct, dur) => { setBgCurrentTime(ct); setBgDuration(dur); }}
              onAudioReady={setBgAudioReady}
            />
          )}
        </div>
      </main>
      {showMiniPlayer && activeSessionId && (
        <MiniPlayer
          sessionId={activeSessionId}
          isPlaying={bgIsPlaying}
          currentTime={bgCurrentTime}
          duration={bgDuration}
          onToggle={() => playerRef.current?.togglePlay()}
          onExpand={() => setView("player")}
        />
      )}
    </div>
  );
}

function UserProfileWidget() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded || !user) return null;

  const name = user.fullName || user.firstName || user.emailAddresses?.[0]?.emailAddress || "User";
  const initials = (user.firstName?.[0] || "") + (user.lastName?.[0] || "") || name[0]?.toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2.5 px-2 py-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="text-white text-xs font-bold">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{name}</p>
      </div>
      <button
        onClick={() => signOut({ redirectUrl: "/" })}
        className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
        title="Sign out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Sidebar({ view, onViewChange }: { view: View; onViewChange: (v: View) => void }) {
  const navItems = [
    { id: "generate" as View, label: "Generate", icon: Zap },
    { id: "library" as View, label: "My Library", icon: BookOpen },
  ];

  return (
    <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Headphones className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground tracking-tight">PodLearn AI</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              view === id
                ? "bg-primary text-white"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 pb-5 border-t border-border pt-4">
        <UserProfileWidget />
      </div>
    </aside>
  );
}

function GeneratePage({ onSessionReady }: { onSessionReady: (id: string, script?: DialogueTurn[]) => void }) {
  const createSession = useCreateSession();
  const uploadContent = useUploadContent();
  const generatePodcast = useGeneratePodcast();

  const [content, setContent] = useState("");
  const [style, setStyle] = useState<StyleOption>("casual");
  const [tone, setTone] = useState<ToneOption>("friendly");
  const [accent, setAccent] = useState<AccentOption>("american");
  const [length, setLength] = useState<LengthOption>("descriptive");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const styleLabels: Record<StyleOption, string> = {
    casual: "Casual",
    technical: "Technical",
    storytelling: "Storytelling",
  };
  const toneLabels: Record<ToneOption, string> = {
    friendly: "Friendly",
    professional: "Professional",
    humorous: "Humorous",
    serious: "Serious",
  };
  const accentLabels: Record<AccentOption, string> = {
    american: "American",
    british: "British",
    australian: "Australian",
    neutral: "Neutral",
  };

  const summary = `Create a ${style} conversation for a ${tone} audience with a ${length} duration. The accent will be ${accent}.`;

  const handleGenerate = async () => {
    if (!content.trim()) return;
    setIsGenerating(true);
    setStatusMessage("Setting up studio...");
    try {
      const session = await createSession.mutateAsync();
      setStatusMessage("Processing your content...");
      const isUrl = /^https?:\/\//i.test(content.trim());
      const actualType: "url" | "text" = isUrl ? "url" : "text";
      await uploadContent.mutateAsync({
        id: session.id,
        data: { type: actualType, content, title: content.slice(0, 80) },
      });
      setStatusMessage("Starting generation...");
      await generatePodcast.mutateAsync({
        id: session.id,
        data: { style, tone, accent, length },
      });
      onSessionReady(session.id, undefined);
    } catch (err: any) {
      console.error(err);
      const apiMsg = err?.data?.error || err?.message || "";
      const userMsg = apiMsg.length > 0 && apiMsg.length < 120 ? apiMsg : "Something went wrong. Please try again.";
      setStatusMessage(userMsg);
      setTimeout(() => { setIsGenerating(false); setStatusMessage(""); }, 5000);
      return;
    }
    setIsGenerating(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-1">Generate a conversation</h1>
        <p className="text-muted-foreground text-sm">Discussions are generated with AI voices</p>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-4 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Textarea
            placeholder="Paste in a URL or paste/type any text content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isGenerating}
            className="pl-12 pr-4 pt-3.5 min-h-[56px] max-h-48 rounded-2xl border-border bg-card shadow-sm text-base resize-none focus-visible:ring-primary/30 focus-visible:border-primary/40 overflow-auto"
            rows={content.split("\n").length > 1 || content.length > 80 ? 4 : 1}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Works with web article URLs, research papers, blog posts, and any pasted text.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Define your audio dialogue</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(styleLabels) as StyleOption[]).map((s) => (
                <PillToggle key={s} active={style === s} onClick={() => setStyle(s)} label={styleLabels[s]} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Tone</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(toneLabels) as ToneOption[]).map((t) => (
                <PillToggle key={t} active={tone === t} onClick={() => setTone(t)} label={toneLabels[t]} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Accent</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(accentLabels) as AccentOption[]).map((a) => (
                <PillToggle key={a} active={accent === a} onClick={() => setAccent(a)} label={accentLabels[a]} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Length</h2>
            <div className="flex flex-wrap gap-2">
              <PillToggle active={length === "concise"} onClick={() => setLength("concise")} label="Concise" />
              <PillToggle active={length === "descriptive"} onClick={() => setLength("descriptive")} label="Descriptive" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Voices
              <span className="ml-1 text-muted-foreground font-normal text-xs">(AI generated)</span>
            </h2>
            <div className="flex items-center gap-6">
              <VoiceAvatar name="Jamie" role="Host" gradient="from-amber-400 to-orange-500" />
              <VoiceAvatar name="Alex" role="Guest" gradient="from-violet-500 to-indigo-600" />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <p className="text-base text-foreground/80 leading-relaxed font-light">
              {summary.split(/(casual|technical|storytelling|friendly|professional|humorous|serious|concise|descriptive|american|british|australian|neutral)/gi).map((part, i) => {
                const keywords = ["casual", "technical", "storytelling", "friendly", "professional", "humorous", "serious", "concise", "descriptive", "american", "british", "australian", "neutral"];
                if (keywords.includes(part.toLowerCase())) {
                  return (
                    <span key={i} className="inline-flex items-center mx-0.5 px-2 py-0.5 bg-muted rounded text-foreground text-sm font-medium">
                      {part}
                    </span>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !content.trim()}
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 h-11 text-sm font-medium shadow-sm gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {statusMessage}
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-all ${
        active
          ? "bg-primary/10 border-primary/40 text-primary font-medium"
          : "bg-background border-border text-foreground/70 hover:border-primary/20 hover:text-foreground"
      }`}
    >
      {active && <Check className="w-3 h-3" />}
      {label}
    </button>
  );
}

function VoiceAvatar({ name, role, gradient }: { name: string; role: string; gradient: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
        <Headphones className="w-5 h-5 text-white" />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}

function GeneratingCard({ session }: { session: PodcastSession }) {
  const [elapsed, setElapsed] = useState(0);
  const ESTIMATED_DURATION = 150;

  useEffect(() => {
    const createdMs = session.createdAt ? new Date(session.createdAt).getTime() : Date.now();
    const initial = Math.max(0, (Date.now() - createdMs) / 1000);
    setElapsed(initial);
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 0.5);
    }, 500);
    return () => clearInterval(interval);
  }, [session.createdAt]);

  const progress = Math.min(95, (elapsed / ESTIMATED_DURATION) * 100);
  const progressLabel = progress < 20 ? "Preparing content..." : progress < 50 ? "Writing dialogue..." : progress < 80 ? "Recording audio..." : "Almost ready...";

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-4 overflow-hidden aspect-[3/4] flex flex-col justify-between shadow-md">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-transparent animate-pulse" />
      </div>
      <div className="relative">
        <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white/80 animate-spin mb-3" />
        <p className="text-white/80 font-semibold text-sm leading-tight uppercase tracking-wide line-clamp-3">
          {session.title || "Generating podcast..."}
        </p>
      </div>
      <div className="relative space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-xs">{progressLabel}</span>
          <span className="text-white/60 text-xs font-mono">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-400 to-indigo-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/40 text-xs">Generating — check back shortly</p>
      </div>
    </div>
  );
}

function ErrorCard({ session }: { session: PodcastSession }) {
  const deleteSession = useDeleteSession();
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-red-900 to-slate-900 p-4 overflow-hidden aspect-[3/4] flex flex-col justify-between shadow-md">
      <div>
        <div className="w-6 h-6 rounded-full bg-red-500/30 border border-red-500/50 flex items-center justify-center mb-3">
          <X className="w-3.5 h-3.5 text-red-400" />
        </div>
        <p className="text-white/80 font-semibold text-sm leading-tight uppercase tracking-wide line-clamp-3">
          {session.title || "Generation failed"}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-red-400/80 text-xs">Generation failed. Please try again.</p>
        <button
          onClick={() => deleteSession.mutateAsync(session.id)}
          disabled={deleteSession.isPending}
          className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-full px-3 py-1.5 text-xs font-medium transition-all"
        >
          {deleteSession.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Remove
        </button>
      </div>
    </div>
  );
}

function LibraryPage({ onPlay }: { onPlay: (id: string) => void }) {
  const { data: sessions, isLoading } = useListSessions({
    query: {
      refetchInterval: (q) => {
        const data = q.state.data;
        return data?.some((s) => s.status === "processing") ? 4000 : false;
      },
    },
  });

  const processingSessions = sessions?.filter((s) => s.status === "processing") ?? [];
  const errorSessions = sessions?.filter((s) => s.status === "error") ?? [];
  const readySessions = sessions?.filter((s) => s.status === "ready") ?? [];
  const hasAny = processingSessions.length > 0 || errorSessions.length > 0 || readySessions.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-1">My Library</h1>
        <p className="text-muted-foreground text-sm">Your generated podcast conversations</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasAny ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Headphones className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground mb-1">No podcasts yet</h3>
          <p className="text-sm text-muted-foreground">Generate your first conversation to see it here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {processingSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Generating</h2>
                <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                  {processingSessions.length} in progress
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {processingSessions.map((session) => (
                  <GeneratingCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {errorSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Failed</h2>
                <div className="flex items-center gap-1.5 bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {errorSessions.length} failed
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {errorSessions.map((session) => (
                  <ErrorCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {readySessions.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Ready to play</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {readySessions.map((session) => (
                  <PodcastCard key={session.id} session={session} onPlay={() => onPlay(session.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PodcastCard({ session, onPlay }: { session: PodcastSession; onPlay: () => void }) {
  const { getToken } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const deleteSession = useDeleteSession();

  const styleColors: Record<string, string> = {
    casual: "from-violet-600 to-indigo-800",
    technical: "from-blue-600 to-cyan-800",
    storytelling: "from-rose-600 to-pink-800",
  };
  const gradient = styleColors[session.podcastStyle ?? "casual"] ?? "from-violet-600 to-indigo-800";

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!session.audioUrl) return;
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(session.audioUrl, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${session.title || "podcast"}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {}
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm(`Delete "${session.title || "this podcast"}"?`)) return;
    await deleteSession.mutateAsync(session.id);
  };

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-4 cursor-pointer group overflow-hidden aspect-[3/4] flex flex-col justify-between shadow-md hover:shadow-xl transition-shadow`}
      onClick={onPlay}
    >
      <div>
        <Headphones className="w-6 h-6 text-white/70 mb-3" />
        <p className="text-white font-semibold text-sm leading-tight uppercase tracking-wide line-clamp-3">
          {session.title || "Podcast Session"}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full px-3 py-1.5 text-xs font-medium transition-all backdrop-blur-sm"
        >
          <Play className="w-3 h-3 fill-white" />
          Play
        </button>
        <div className="relative" ref={menuRef}>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-all"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
            title="More options"
          >
            <Ellipsis className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute bottom-9 right-0 z-50 bg-white rounded-xl shadow-xl border border-border py-1 min-w-[150px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDownload}
                disabled={!session.audioUrl}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                Download MP3
              </button>
              <div className="h-px bg-border mx-2" />
              <button
                onClick={handleDelete}
                disabled={deleteSession.isPending}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleteSession.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WordHighlightText({
  text,
  turnStart,
  turnEnd,
  currentTime,
  isActive,
  mode,
}: {
  text: string;
  turnStart: number;
  turnEnd: number;
  currentTime: number;
  isActive: boolean;
  mode: "cc" | "transcript";
}) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const activeWord = useMemo(() => {
    if (!isActive) return -1;
    const turnDur = turnEnd - turnStart;
    if (turnDur <= 0) return -1;
    if (currentTime < turnStart || currentTime >= turnEnd) return -1;
    const elapsed = currentTime - turnStart;
    const totalLen = words.reduce((s, w) => s + w.length, 0);
    if (totalLen === 0) return -1;
    let cum = 0;
    for (let i = 0; i < words.length; i++) {
      cum += words[i].length;
      if (elapsed < (cum / totalLen) * turnDur) return i;
    }
    return words.length - 1;
  }, [isActive, currentTime, turnStart, turnEnd, words]);

  if (activeWord < 0) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {words.map((word, i) => {
        const isPast = i < activeWord;
        const isCurrent = i === activeWord;
        let cls: string;
        if (mode === "cc") {
          if (isCurrent) cls = "text-yellow-300 font-bold scale-105 inline-block";
          else if (isPast) cls = "text-white/70";
          else cls = "text-white/30";
        } else {
          if (isCurrent) cls = "text-primary font-bold bg-primary/15 rounded px-1 -mx-0.5";
          else if (isPast) cls = "text-foreground";
          else cls = "text-muted-foreground/40";
        }
        return (
          <span key={i} className={`transition-colors duration-100 ${cls}`}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

type RaiseHandState = "idle" | "listening" | "thinking" | "answering";
type QAMessage = { role: "user" | "ai"; text: string; isVoice?: boolean };

interface PlayerHandle {
  togglePlay: () => void;
}

interface PlayerPageProps {
  sessionId: string;
  transcript: DialogueTurn[] | null;
  onBack: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onAudioReady?: (ready: boolean) => void;
}

const PlayerPage = forwardRef<PlayerHandle, PlayerPageProps>(function PlayerPage({
  sessionId,
  transcript: initialTranscript,
  onBack,
  onPlayStateChange,
  onTimeUpdate,
  onAudioReady,
}, ref) {
  const { data: session } = useGetSession(sessionId, {
    query: {
      refetchInterval: (q) => (q.state.data?.status === "processing" ? 3000 : false),
    },
  });

  const transcript = initialTranscript ?? session?.script ?? null;
  const { getToken } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const answerAudioRef = useRef<HTMLAudioElement>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const lastFetchedAudioUrl = useRef<string | null>(null);
  const activeTurnRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeTurnIndex, setActiveTurnIndex] = useState(-1);
  const [estimatedTimestamps, setEstimatedTimestamps] = useState<{ start: number; end: number }[]>([]);
  const [showCC, setShowCC] = useState(false);

  const [raiseHandState, setRaiseHandState] = useState<RaiseHandState>("idle");
  const [raiseHandTextMode, setRaiseHandTextMode] = useState(false);
  const [raiseHandTextInput, setRaiseHandTextInput] = useState("");
  const raiseHandInputRef = useRef<HTMLInputElement>(null);
  const [savedTime, setSavedTime] = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const askQuestion = useAskQuestion();

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  useImperativeHandle(ref, () => ({
    togglePlay: () => {
      if (!audioRef.current) return;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    },
  }));

  useEffect(() => { onPlayStateChange?.(isPlaying); }, [isPlaying, onPlayStateChange]);
  useEffect(() => { onTimeUpdate?.(currentTime, duration); }, [currentTime, duration, onTimeUpdate]);
  useEffect(() => { onAudioReady?.(audioReady); }, [audioReady, onAudioReady]);

  useEffect(() => {
    if (duration > 0 && transcript && transcript.length > 0) {
      const totalChars = transcript.reduce((sum, t) => sum + t.text.length, 0);
      let cumulative = 0;
      const ts = transcript.map((t) => {
        const proportion = t.text.length / totalChars;
        const segDur = proportion * duration;
        const start = cumulative;
        cumulative += segDur;
        return { start, end: cumulative };
      });
      setEstimatedTimestamps(ts);
    }
  }, [duration, transcript]);

  useEffect(() => {
    const audioUrl = session?.audioUrl;
    if (!audioUrl || audioUrl === lastFetchedAudioUrl.current) return;
    let cancelled = false;
    setAudioReady(false);
    setAudioLoading(true);

    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        console.log("[audio] Fetching:", audioUrl);
        const res = await fetch(audioUrl, { headers, cache: "no-store" });
        console.log("[audio] Response status:", res.status, "ok:", res.ok);
        if (!res.ok || cancelled) { setAudioLoading(false); return; }
        const blob = await res.blob();
        console.log("[audio] Blob size:", blob.size, "type:", blob.type);
        if (cancelled || blob.size === 0) { setAudioLoading(false); return; }
        const oldUrl = audioBlobUrlRef.current;
        const blobUrl = URL.createObjectURL(blob);
        audioBlobUrlRef.current = blobUrl;
        lastFetchedAudioUrl.current = audioUrl;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        setAudioBlobUrl(blobUrl);
        setAudioLoading(false);
        setAudioReady(true);
        console.log("[audio] Ready! blobUrl:", blobUrl);
      } catch (e) {
        console.error("[audio] Failed to fetch:", e);
        if (!cancelled) setAudioLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.audioUrl, getToken]);

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
        audioBlobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeTurnRef.current && transcriptContainerRef.current) {
      activeTurnRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeTurnIndex]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur);
    if (dur > 0) setProgress((cur / dur) * 100);
    if (estimatedTimestamps.length > 0) {
      const idx = estimatedTimestamps.findIndex((ts) => cur >= ts.start && cur < ts.end);
      setActiveTurnIndex(idx);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    console.log("[play] toggling. src:", audioRef.current.src?.slice(0, 60), "readyState:", audioRef.current.readyState, "audioReady:", audioReady);
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error("[play] error:", err);
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = next;
    setSpeed(next);
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const resumePodcast = useCallback((fromTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = fromTime;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
    setRaiseHandState("idle");
    setRaiseHandTextMode(false);
    setRaiseHandTextInput("");
  }, []);

  const fetchAuthAudio = useCallback(async (url: string): Promise<string | null> => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  }, [getToken]);

  const handleAskAndAnswer = useCallback(async (question: string, resumeFrom: number) => {
    setQaMessages((prev) => [...prev, { role: "user", text: question, isVoice: true }]);
    setRaiseHandState("thinking");
    try {
      const res = await askQuestion.mutateAsync({ id: sessionId, data: { question } });
      setQaMessages((prev) => [...prev, { role: "ai", text: res.answer }]);
      if (res.answerAudioUrl && answerAudioRef.current) {
        setRaiseHandState("answering");
        const blobUrl = await fetchAuthAudio(res.answerAudioUrl);
        if (blobUrl && answerAudioRef.current) {
          answerAudioRef.current.src = blobUrl;
          answerAudioRef.current.play().catch(() => {});
          answerAudioRef.current.onended = () => { URL.revokeObjectURL(blobUrl); resumePodcast(resumeFrom); };
        } else {
          resumePodcast(resumeFrom);
        }
      } else {
        resumePodcast(resumeFrom);
      }
    } catch {
      setQaMessages((prev) => [...prev, { role: "ai", text: "Sorry, I had trouble answering that." }]);
      resumePodcast(resumeFrom);
    }
  }, [askQuestion, sessionId, resumePodcast, fetchAuthAudio]);

  const startRaiseHand = useCallback(() => {
    if (raiseHandState !== "idle" || !session?.audioUrl) return;
    const time = audioRef.current?.currentTime ?? 0;
    setSavedTime(time);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setRaiseHandState("listening");
    setRaiseHandTextMode(true);
    setTimeout(() => raiseHandInputRef.current?.focus(), 100);
  }, [raiseHandState, session]);

  const cancelRaiseHand = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (answerAudioRef.current) {
      answerAudioRef.current.pause();
      answerAudioRef.current.src = "";
    }
    setRaiseHandTextMode(false);
    setRaiseHandTextInput("");
    resumePodcast(savedTime);
  }, [savedTime, resumePodcast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        if (raiseHandState === "idle") startRaiseHand();
        else if (raiseHandState === "listening") cancelRaiseHand();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [raiseHandState, startRaiseHand, cancelRaiseHand]);

  const styleColors: Record<string, string> = {
    casual: "from-violet-600 to-indigo-700",
    technical: "from-blue-600 to-cyan-700",
    storytelling: "from-rose-600 to-pink-700",
  };
  const gradient = styleColors[session?.podcastStyle ?? "casual"] ?? "from-violet-600 to-indigo-700";

  const raiseHandLabel: Record<RaiseHandState, string> = {
    idle: "Raise Hand",
    listening: "🎤 Listening...",
    thinking: "🧠 Thinking...",
    answering: "🔊 Answering...",
  };

  if (session?.status === "processing") {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to library
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative">
            <Loader2 className="w-9 h-9 text-primary animate-spin" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Generating your podcast...</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Our AI hosts are recording your conversation. This usually takes 30–90 seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to library
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 shadow-lg relative overflow-hidden`}>
            {raiseHandState !== "idle" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-4 rounded-2xl p-6">
                <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                  {raiseHandState === "listening" && !raiseHandTextMode && (
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                        <Mic className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />
                    </div>
                  )}
                  {raiseHandState === "listening" && raiseHandTextMode && (
                    <div className="w-12 h-12 rounded-full bg-violet-500 flex items-center justify-center">
                      <Hand className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {raiseHandState === "thinking" && (
                    <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  {raiseHandState === "answering" && (
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                      <Volume2 className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <p className="text-white font-semibold text-lg">
                    {raiseHandTextMode && raiseHandState === "listening" ? "✋ Type your question" : raiseHandLabel[raiseHandState]}
                  </p>
                  {raiseHandTextMode && raiseHandState === "listening" && (
                    <form
                      className="w-full flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const q = raiseHandTextInput.trim();
                        if (!q) return;
                        setRaiseHandTextInput("");
                        setRaiseHandTextMode(false);
                        handleAskAndAnswer(q, savedTime);
                      }}
                    >
                      <input
                        ref={raiseHandInputRef}
                        value={raiseHandTextInput}
                        onChange={(e) => setRaiseHandTextInput(e.target.value)}
                        placeholder="Ask the hosts anything..."
                        className="flex-1 bg-white/15 border border-white/30 rounded-full px-4 py-2 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-white/60"
                      />
                      <button
                        type="submit"
                        disabled={!raiseHandTextInput.trim()}
                        className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white rounded-full px-4 py-2 text-sm font-medium transition-all"
                      >
                        Ask
                      </button>
                    </form>
                  )}
                  {(raiseHandState === "listening" || raiseHandState === "answering") && (
                    <button
                      onClick={cancelRaiseHand}
                      className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm border border-white/30 rounded-full px-4 py-1.5 transition-all hover:border-white/60"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Headphones className="w-5 h-5 text-white/70" />
                  <span className="text-white/70 text-xs uppercase tracking-wider font-medium">
                    {session?.podcastStyle} · AI Podcast
                  </span>
                </div>
                <h2 className="text-white font-semibold text-lg leading-snug max-w-xs">
                  {session?.title || "Podcast Conversation"}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <VoiceAvatar name="Jamie" role="" gradient="from-amber-400 to-orange-500" />
                <VoiceAvatar name="Alex" role="" gradient="from-violet-400 to-indigo-500" />
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioBlobUrl ?? undefined}
              preload="auto"
              onCanPlay={() => setAudioReady(true)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <audio ref={answerAudioRef} />

            <div className="h-1.5 bg-white/20 rounded-full mb-1 cursor-pointer" onClick={handleSeek}>
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-white/60 text-xs mb-6">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={cycleSpeed}
                  className="text-white/70 hover:text-white text-sm font-medium w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  {speed}x
                </button>
                {transcript && transcript.length > 0 && (
                  <button
                    onClick={() => setShowCC((c) => !c)}
                    title="Toggle closed captions"
                    className={`text-xs font-bold px-1.5 py-0.5 rounded border transition-all leading-none ${
                      showCC
                        ? "border-white text-white bg-white/20"
                        : "border-white/40 text-white/50 hover:text-white hover:border-white/70"
                    }`}
                  >
                    CC
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => audioRef.current && (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15))}
                  className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={togglePlay}
                  disabled={!audioReady || audioLoading}
                  className="w-14 h-14 rounded-full bg-white text-primary flex items-center justify-center shadow-md hover:scale-105 transition-transform disabled:opacity-40"
                >
                  {audioLoading
                    ? <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    : isPlaying
                      ? <Pause className="w-6 h-6 fill-primary" />
                      : <Play className="w-6 h-6 fill-primary ml-0.5" />}
                </button>
                <button
                  onClick={() => audioRef.current && (audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 15))}
                  className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <FastForward className="w-5 h-5" />
                </button>
              </div>
              {audioReady ? (
                <button
                  onClick={raiseHandState === "idle" ? startRaiseHand : cancelRaiseHand}
                  title="Raise Hand to ask a question (press R)"
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    raiseHandState !== "idle"
                      ? "bg-red-400/80 text-white animate-pulse"
                      : "bg-white/15 hover:bg-white/25 text-white/80 hover:text-white"
                  }`}
                >
                  <Hand className="w-4.5 h-4.5" />
                </button>
              ) : (
                <div className="w-10" />
              )}
            </div>

            {showCC && transcript && (
              <div className="mt-4 min-h-[72px] flex items-center justify-center">
                {activeTurnIndex >= 0 && transcript[activeTurnIndex] ? (
                  <div
                    key={activeTurnIndex}
                    className="w-full rounded-xl bg-black/75 px-4 py-3 text-center animate-in fade-in duration-300"
                  >
                    <p
                      className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                      style={{ color: transcript[activeTurnIndex].host === "A" ? "#fbbf24" : "#a78bfa" }}
                    >
                      {transcript[activeTurnIndex].host === "A" ? "Jamie" : "Alex"}
                    </p>
                    <p className="text-white text-sm leading-relaxed">
                      <WordHighlightText
                        text={transcript[activeTurnIndex].text}
                        turnStart={estimatedTimestamps[activeTurnIndex]?.start ?? 0}
                        turnEnd={estimatedTimestamps[activeTurnIndex]?.end ?? 0}
                        currentTime={currentTime}
                        isActive={isPlaying && activeTurnIndex >= 0}
                        mode="cc"
                      />
                    </p>
                  </div>
                ) : (
                  <div className="w-full rounded-xl bg-black/75 px-4 py-3 text-center">
                    <p className="text-white/30 text-xs italic">Captions will appear here during playback</p>
                  </div>
                )}
              </div>
            )}

            {session?.audioUrl && raiseHandState === "idle" && (
              <p className="text-center text-white/40 text-xs mt-3">
                Press <kbd className="bg-white/20 rounded px-1 py-0.5 font-mono text-[10px]">R</kbd> or tap ✋ to ask the hosts a question
              </p>
            )}
          </div>

          {transcript && transcript.length > 0 && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Live Transcript</h3>
                {isPlaying && activeTurnIndex >= 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    Line {activeTurnIndex + 1} of {transcript.length}
                  </div>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto" ref={transcriptContainerRef}>
                <div className="py-2">
                  {transcript.map((turn, idx) => {
                    const isActive = idx === activeTurnIndex;
                    const isJamie = turn.host === "A";
                    return (
                      <div
                        key={idx}
                        ref={isActive ? activeTurnRef : undefined}
                        className={`flex gap-3 px-5 py-2.5 transition-all duration-300 ${
                          isActive ? "bg-primary/10 border-l-2 border-primary" : "border-l-2 border-transparent"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br shrink-0 flex items-center justify-center mt-0.5 ${
                          isJamie ? "from-amber-400 to-orange-500" : "from-violet-500 to-indigo-600"
                        }`}>
                          <span className="text-white text-[10px] font-bold">{isJamie ? "J" : "A"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-semibold mb-0.5 block ${
                            isJamie ? "text-amber-600" : "text-violet-600"
                          }`}>
                            {isJamie ? "Jamie" : "Alex"}
                          </span>
                          <p className={`text-sm leading-relaxed transition-all duration-300 ${
                            isActive ? "text-foreground font-medium" : "text-muted-foreground"
                          }`}>
                            {turn.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 h-[calc(100vh-10rem)] sticky top-6">
          <QAChat
            sessionId={sessionId}
            disabled={session?.status !== "ready"}
            messages={qaMessages}
            onNewMessages={setQaMessages}
            isPending={askQuestion.isPending}
            onAsk={async (q) => {
              setQaMessages((prev) => [...prev, { role: "user", text: q }]);
              const res = await askQuestion.mutateAsync({ id: sessionId, data: { question: q } });
              setQaMessages((prev) => [...prev, { role: "ai", text: res.answer }]);
              if (res.answerAudioUrl && answerAudioRef.current) {
                const blobUrl = await fetchAuthAudio(res.answerAudioUrl);
                if (blobUrl && answerAudioRef.current) {
                  answerAudioRef.current.src = blobUrl;
                  answerAudioRef.current.play().catch(() => {});
                  answerAudioRef.current.onended = () => URL.revokeObjectURL(blobUrl);
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
});

function MiniPlayer({
  sessionId,
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onExpand,
}: {
  sessionId: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const { data: session } = useGetSession(sessionId);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const styleColors: Record<string, string> = {
    casual: "from-violet-600 to-indigo-700",
    technical: "from-blue-600 to-cyan-700",
    storytelling: "from-rose-600 to-pink-700",
  };
  const gradient = styleColors[session?.podcastStyle ?? "casual"] ?? "from-violet-600 to-indigo-700";

  return (
    <div className="fixed bottom-0 left-56 right-0 bg-card/95 backdrop-blur border-t border-border shadow-xl z-50">
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-3 px-5 py-2.5">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
          <Headphones className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {session?.title || "Podcast"}
          </p>
          <p className="text-xs text-muted-foreground">
            {fmt(currentTime)} · {fmt(duration)}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
        >
          {isPlaying
            ? <Pause className="w-3.5 h-3.5 fill-white" />
            : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
        </button>
        <button
          onClick={onExpand}
          title="Open player"
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
        >
          <ChevronRight className="w-4 h-4 text-foreground/60" />
        </button>
      </div>
    </div>
  );
}

function QAChat({
  sessionId,
  disabled,
  messages,
  isPending,
  onAsk,
}: {
  sessionId: string;
  disabled: boolean;
  messages: QAMessage[];
  onNewMessages: React.Dispatch<React.SetStateAction<QAMessage[]>>;
  isPending: boolean;
  onAsk: (q: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isPending) return;
    const q = input.trim();
    setInput("");
    try {
      await onAsk(q);
    } catch {
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Ask the hosts
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Type or use Raise Hand ✋ to ask by voice</p>
      </div>

      <div className="flex-1 overflow-auto p-4" ref={scrollRef}>
        {messages.length === 0 && !disabled ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Ask anything about the topic...</p>
            <p className="text-xs text-muted-foreground mt-1 opacity-70">Press R while playing to ask by voice</p>
          </div>
        ) : disabled ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <p className="text-sm text-muted-foreground">Q&amp;A available after generation completes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback className={m.role === "user"
                    ? "bg-muted text-foreground text-xs"
                    : "bg-primary/15 text-primary text-xs"}>
                    {m.role === "user" ? (m.isVoice ? "🎤" : "U") : "🎙️"}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-muted text-foreground rounded-tr-sm"
                    : "bg-primary/10 border border-primary/15 text-foreground rounded-tl-sm"
                }`}>
                  {m.isVoice && m.role === "user" && (
                    <span className="text-xs text-muted-foreground block mb-0.5">🎤 Voice question</span>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex gap-2.5">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs">🎙️</AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-primary/10 border border-primary/15 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Hosts are responding...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            placeholder={disabled ? "Generating..." : "Ask a question..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={disabled || isPending}
            className="rounded-xl border-border bg-background text-sm h-10"
          />
          <Button
            type="submit"
            disabled={!input.trim() || disabled || isPending}
            className="rounded-xl bg-primary text-white hover:bg-primary/90 h-10 px-4 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
