import type { StructuredResponseFormat } from "./generation-core.ts";

type Message = { role: "system" | "user" | "assistant"; content: string };

export type AnthropicUsage = { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number };
export type AnthropicCompletion = { text: string; usage: AnthropicUsage; stopReason: "end_turn" };
export type AnthropicErrorDiagnostics = { status: number; errorType?: string; errorMessage?: string; requestId?: string };

export class AnthropicProviderError extends Error {
  readonly status: number;
  readonly errorType?: string;
  readonly requestId?: string;

  constructor(diagnostics: AnthropicErrorDiagnostics) {
    super(`Anthropic request failed (${diagnostics.status})${diagnostics.errorType ? `: ${diagnostics.errorType}` : ""}.`);
    this.name = "AnthropicProviderError";
    this.status = diagnostics.status;
    this.errorType = diagnostics.errorType;
    this.requestId = diagnostics.requestId;
  }
}

export class AnthropicIncompleteResponseError extends Error {
  readonly status: number;
  readonly stopReason?: string;
  readonly usage: AnthropicUsage;

  constructor(status: number, stopReason: unknown, usage: AnthropicUsage) {
    super("Anthropic returned an incomplete or refused response.");
    this.name = "AnthropicIncompleteResponseError";
    this.status = status;
    this.stopReason = safeText(stopReason, 80);
    this.usage = usage;
  }
}

function safeText(value: unknown, maxLength = 300): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeRequestId(value: string | null): string | undefined {
  const candidate = safeText(value, 128);
  return candidate && /^[A-Za-z0-9._-]+$/.test(candidate) ? candidate : undefined;
}

async function errorDiagnostics(response: Response): Promise<AnthropicErrorDiagnostics> {
  let payload: { error?: { type?: unknown; message?: unknown }; request_id?: unknown } | undefined;
  try { payload = await response.json() as typeof payload; } catch { /* Error bodies are optional and may not be JSON. */ }
  return {
    status: response.status,
    errorType: safeText(payload?.error?.type, 80),
    errorMessage: safeText(payload?.error?.message),
    requestId: safeRequestId(response.headers.get("request-id")) ?? safeRequestId(payload?.request_id as string | null),
  };
}

function developmentErrorLog(input: { model: string }, diagnostics: AnthropicErrorDiagnostics): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn("[Anthropic Provider]", JSON.stringify({ provider: "anthropic", model: input.model, httpStatus: diagnostics.status, anthropicErrorType: diagnostics.errorType, anthropicErrorMessage: diagnostics.errorMessage, requestId: diagnostics.requestId }));
}

// Anthropic accepts the JSON Schema primitives used by our contracts, but not
// application-side validation bounds. Those remain enforced after parsing.
export function anthropicProviderSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(anthropicProviderSchema);
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.type)) {
    const { type, ...rest } = object;
    return { anyOf: type.map((entry) => anthropicProviderSchema({ ...rest, type: entry })) };
  }
  return Object.fromEntries(Object.entries(object)
    .filter(([key]) => !["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength"].includes(key))
    .map(([key, child]) => [key, anthropicProviderSchema(child)]));
}

export async function completeAnthropicWithDetails(input: { apiKey: string; model: string; messages: Message[]; signal: AbortSignal; responseFormat?: StructuredResponseFormat; maxTokens?: number }, request: typeof fetch = fetch): Promise<AnthropicCompletion> {
  const response = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: input.signal,
    headers: { "content-type": "application/json", "x-api-key": input.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 8192,
      system: input.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n"),
      messages: input.messages.filter((message) => message.role !== "system"),
      ...(input.responseFormat?.type === "json_schema" ? { output_config: { format: { type: "json_schema", schema: anthropicProviderSchema(input.responseFormat.json_schema.schema) } } } : {}),
    }),
  });
  if (!response.ok) {
    const diagnostics = await errorDiagnostics(response);
    developmentErrorLog(input, diagnostics);
    throw new AnthropicProviderError(diagnostics);
  }
  const payload = await response.json() as { stop_reason?: unknown; content?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown; cache_read_input_tokens?: unknown; cache_creation_input_tokens?: unknown } };
  const usage = { inputTokens: typeof payload.usage?.input_tokens === "number" ? payload.usage.input_tokens : undefined, outputTokens: typeof payload.usage?.output_tokens === "number" ? payload.usage.output_tokens : undefined, cacheReadTokens: typeof payload.usage?.cache_read_input_tokens === "number" ? payload.usage.cache_read_input_tokens : undefined, cacheWriteTokens: typeof payload.usage?.cache_creation_input_tokens === "number" ? payload.usage.cache_creation_input_tokens : undefined };
  if (payload.stop_reason !== "end_turn" || !Array.isArray(payload.content)) throw new AnthropicIncompleteResponseError(response.status, payload.stop_reason, usage);
  const text = payload.content.filter((block: { type?: string; text?: unknown }) => block.type === "text" && typeof block.text === "string").map((block: { text: string }) => block.text).join("");
  if (!text.trim()) throw new Error("Anthropic returned an empty response.");
  return { text, usage, stopReason: "end_turn" };
}

export async function completeAnthropic(input: { apiKey: string; model: string; messages: Message[]; signal: AbortSignal; responseFormat?: StructuredResponseFormat }, request: typeof fetch = fetch): Promise<string> {
  return (await completeAnthropicWithDetails(input, request)).text;
}
