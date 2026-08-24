import "server-only";

// Single swappable point for the OpenAI-compatible AI provider.
const provider: "openai" | "groq" | "nvidia" = process.env.AI_PROVIDER === "openai" ? "openai" : process.env.AI_PROVIDER === "groq" ? "groq" : "nvidia";
export const AI_CONFIG = {
  provider,
  baseURL: provider === "openai" ? "https://api.openai.com/v1" : provider === "groq" ? "https://api.groq.com/openai/v1" : "https://integrate.api.nvidia.com/v1",
  apiKey: provider === "openai" ? process.env.OPENAI_API_KEY : provider === "groq" ? process.env.GROQ_API_KEY : process.env.NVIDIA_API_KEY,
  model: provider === "openai" ? (process.env.OPENAI_MODEL || "gpt-4o-mini") : provider === "groq" ? (process.env.GROQ_MODEL || "openai/gpt-oss-120b") : (process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"),
  apiKeyEnv: provider === "openai" ? "OPENAI_API_KEY" : provider === "groq" ? "GROQ_API_KEY" : "NVIDIA_API_KEY",
  providerTimeoutMs: 120_000,
  generationBudgetMs: 270_000,
  embeddingTimeoutMs: 90_000,
  transportRetries: 0,
} as const;
