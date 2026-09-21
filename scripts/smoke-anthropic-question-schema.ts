import { AnthropicProviderError, completeAnthropicWithDetails } from "../lib/ai/anthropic.ts";
import { questionContentResponseFormat } from "../lib/ai/generation-core.ts";

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  try {
    const result = await completeAnthropicWithDetails({
      apiKey, model, maxTokens: 180, signal: AbortSignal.timeout(20_000), responseFormat: questionContentResponseFormat(),
      messages: [{ role: "user", content: "Return exactly two Grade 8 Mathematics question rows. slot-a: a 1-mark text question. slot-b: a 1-mark question with a small table visual. Use [] options. The visual must use the compact envelope and a JSON-encoded table specification." }],
    });
    const payload = JSON.parse(result.text) as { questions?: unknown[] };
    if (!Array.isArray(payload.questions) || payload.questions.length !== 2) throw new Error("The provider response did not contain two question rows.");
    console.info(JSON.stringify({ provider: "anthropic", model, outcome: "success", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }));
  } catch (error) {
    if (error instanceof AnthropicProviderError) console.info(JSON.stringify({ provider: "anthropic", model, outcome: "provider_error", httpStatus: error.status, anthropicErrorType: error.errorType, requestId: error.requestId }));
    else console.info(JSON.stringify({ provider: "anthropic", model, outcome: "request_error", errorType: error instanceof Error ? error.name : "unknown", errorMessage: error instanceof Error ? error.message.replace(/[\r\n\t]+/g, " ").slice(0, 300) : undefined }));
    process.exitCode = 1;
  }
}

void main();
