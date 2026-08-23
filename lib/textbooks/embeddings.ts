import "server-only";
import { AI_CONFIG } from "@/lib/ai/config";
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from "./constants";

type EmbeddingResponse = { data?: { index: number; embedding: number[] }[] };

export async function embedTexts(input: string[], inputType: "passage" | "query"): Promise<number[][]> {
  if (!AI_CONFIG.apiKey) throw new Error("Textbook indexing is not configured.");
  const response = await fetch(`${AI_CONFIG.baseURL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AI_CONFIG.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input, input_type: inputType, encoding_format: "float", truncate: "NONE" }),
    signal: AbortSignal.timeout(AI_CONFIG.embeddingTimeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The embedding provider could not process this textbook.");
  const payload = await response.json() as EmbeddingResponse;
  const vectors = [...(payload.data ?? [])].sort((a, b) => a.index - b.index).map((item) => item.embedding);
  if (vectors.length !== input.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSION || vector.some((value) => !Number.isFinite(value)))) {
    throw new Error("The embedding provider returned an unexpected vector shape.");
  }
  return vectors;
}
