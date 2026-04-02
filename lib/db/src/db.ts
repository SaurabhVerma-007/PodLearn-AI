import { createClient } from "@supabase/supabase-js";
import type { Session } from "./schema";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set.");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set.");
}

const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TABLE = "podcast_sessions";

function toSession(row: any): Session {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    title: row.title ?? null,
    status: row.status,
    contentType: row.content_type ?? null,
    contentPreview: row.content_preview ?? null,
    contentChunks: row.content_chunks ?? [],
    podcastStyle: row.podcast_style ?? null,
    scriptTurns: row.script_turns ?? null,
    script: row.script ?? [],
    audioFilename: row.audio_filename ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(data: Partial<Session> & { updatedAt?: Date | string }): Record<string, any> {
  const row: Record<string, any> = {};
  if (data.id !== undefined) row.id = data.id;
  if (data.userId !== undefined) row.user_id = data.userId;
  if (data.title !== undefined) row.title = data.title;
  if (data.status !== undefined) row.status = data.status;
  if (data.contentType !== undefined) row.content_type = data.contentType;
  if (data.contentPreview !== undefined) row.content_preview = data.contentPreview;
  if (data.contentChunks !== undefined) row.content_chunks = data.contentChunks;
  if (data.podcastStyle !== undefined) row.podcast_style = data.podcastStyle;
  if (data.scriptTurns !== undefined) row.script_turns = data.scriptTurns;
  if (data.script !== undefined) row.script = data.script;
  if (data.audioFilename !== undefined) row.audio_filename = data.audioFilename;
  if (data.updatedAt !== undefined) {
    row.updated_at = data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt;
  }
  return row;
}

export const db = {
  async listSessions(userId: string): Promise<Session[]> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSession);
  },

  async createSession(values: { id: string; userId: string; status: string }): Promise<Session> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .insert({ id: values.id, user_id: values.userId, status: values.status })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toSession(data);
  },

  async getSession(id: string, userId: string): Promise<Session | null> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toSession(data) : null;
  },

  async updateSession(id: string, values: Partial<Session> & { updatedAt?: Date }): Promise<void> {
    const row = toRow(values);
    const { error } = await supabaseClient.from(TABLE).update(row).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async deleteSession(id: string, userId: string): Promise<void> {
    const { error } = await supabaseClient.from(TABLE).delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
  },

  async resetStuckSessions(): Promise<number> {
    const { data, error } = await supabaseClient
      .from(TABLE)
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("status", "processing")
      .select("id");
    if (error) {
      console.error("[startup] DB check failed:", error.message);
      return 0;
    }
    return data?.length ?? 0;
  },
};
