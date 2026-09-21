import { completeAnthropicWithDetails, AnthropicProviderError } from "../lib/ai/anthropic.ts";

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  try {
    const result = await completeAnthropicWithDetails({
    apiKey,
    model,
    maxTokens: 24,
    signal: AbortSignal.timeout(15_000),
    messages: [{ role: "user", content: "Return the number one." }],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "minimal_smoke",
        strict: true,
        schema: { type: "object", additionalProperties: false, properties: { value: { type: "integer", const: 1 } }, required: ["value"] },
      },
    },
  });
    JSON.parse(result.text);
    console.info(JSON.stringify({ provider: "anthropic", model, outcome: "success", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }));
  } catch (error) {
    if (error instanceof AnthropicProviderError) {
      console.info(JSON.stringify({ provider: "anthropic", model, outcome: "provider_error", httpStatus: error.status, anthropicErrorType: error.errorType, requestId: error.requestId }));
      process.exitCode = 1;
    } else {
      console.info(JSON.stringify({ provider: "anthropic", model, outcome: "request_error", errorType: error instanceof Error ? error.name : "unknown" }));
      process.exitCode = 1;
    }
  }
}

void main();
