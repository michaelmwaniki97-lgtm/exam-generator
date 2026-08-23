import "server-only";

// Single swappable point for the exam-generation model. NVIDIA NIM exposes an
// OpenAI-compatible /chat/completions API, so moving to OpenAI or Anthropic
// later is a matter of changing baseURL/apiKey/model here (Anthropic would
// also need its own SDK, since it isn't OpenAI-compatible).
export const AI_CONFIG = {
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
  model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
  providerTimeoutMs: 120_000,
  generationBudgetMs: 270_000,
  embeddingTimeoutMs: 90_000,
  transportRetries: 0,
} as const;
