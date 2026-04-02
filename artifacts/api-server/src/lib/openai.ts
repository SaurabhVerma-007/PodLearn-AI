import OpenAI from "openai";

const apiKey = process.env.NVIDIA_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL = process.env.NVIDIA_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error("NVIDIA_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY must be set.");
}

if (!baseURL) {
  throw new Error("NVIDIA_BASE_URL or AI_INTEGRATIONS_OPENAI_BASE_URL must be set.");
}

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
