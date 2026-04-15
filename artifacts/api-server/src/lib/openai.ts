import OpenAI from "openai";

const apiKey = process.env.NVIDIA_API_KEY;
const baseURL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

if (!apiKey) {
  throw new Error(
    "NVIDIA_API_KEY is not set. Add it to your .env file. Get a key at https://build.nvidia.com"
  );
}

console.log(`[openai] Using baseURL: ${baseURL}`);

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
