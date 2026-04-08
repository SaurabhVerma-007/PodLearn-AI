import OpenAI from "openai";

// On Replit: AI_INTEGRATIONS_OPENAI_* are injected automatically and point to the internal model farm proxy.
// Locally: set NVIDIA_API_KEY + NVIDIA_BASE_URL in your .env file.
// We prefer NVIDIA_* so that local dev works without Replit-specific env vars.
const apiKey =
  process.env.NVIDIA_API_KEY ||
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const baseURL =
  process.env.NVIDIA_BASE_URL ||
  (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.includes("localhost")
    ? undefined  // Don't use Replit localhost URL outside Replit
    : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) ||
  "https://integrate.api.nvidia.com/v1";

if (!apiKey) {
  throw new Error(
    "No LLM API key found. Set NVIDIA_API_KEY in your .env file. " +
    "(On Replit, AI_INTEGRATIONS_OPENAI_API_KEY is set automatically.)"
  );
}

console.log(`[openai] Using baseURL: ${baseURL}`);

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
