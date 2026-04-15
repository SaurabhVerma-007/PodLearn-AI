import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.NVIDIA_API_KEY;
  const baseURL =
    process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not set. Add it to your .env file. Get a key at https://build.nvidia.com"
    );
  }

  console.log(`[openai] Using baseURL: ${baseURL}`);
  _openai = new OpenAI({ apiKey, baseURL });
  return _openai;
}

// Keep this for backwards compatibility with existing imports
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return getOpenAIClient()[prop as keyof OpenAI];
  },
});