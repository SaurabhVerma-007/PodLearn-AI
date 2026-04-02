import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("podcast_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  title: text("title"),
  status: text("status").notNull().default("idle"),
  contentType: text("content_type"),
  contentPreview: text("content_preview"),
  contentChunks: jsonb("content_chunks").$type<string[]>().default([]),
  podcastStyle: text("podcast_style"),
  scriptTurns: integer("script_turns"),
  script: jsonb("script").$type<{ host: string; text: string }[]>().default([]),
  audioFilename: text("audio_filename"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
