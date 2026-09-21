import test from "node:test";
import assert from "node:assert/strict";
import { AnthropicIncompleteResponseError, AnthropicProviderError, anthropicProviderSchema, completeAnthropic, completeAnthropicWithDetails } from "./anthropic.ts";

test("Anthropic sends structured output schema and preserves cancellation", async () => {
  const signal = AbortSignal.timeout(1000);
  const result = await completeAnthropic({ apiKey: "test-key", model: "claude-sonnet-5", signal, messages: [{ role: "system", content: "Return JSON." }, { role: "user", content: "Question" }], responseFormat: { type: "json_schema", json_schema: { name: "test", strict: true, schema: { type: "object", additionalProperties: false, properties: { marks: { type: "integer", minimum: 1 } }, required: ["marks"] } } } }, async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init?.signal, signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.system, "Return JSON.");
    assert.equal(body.messages.length, 1);
    assert.equal(body.max_tokens, 8192);
    assert.equal(body.output_config.format.type, "json_schema");
    assert.equal(body.output_config.format.schema.properties.marks.minimum, undefined);
    return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: '{"marks":2}' }] });
  });
  assert.equal(result, '{"marks":2}');
});
test("Anthropic rejects truncated/refused responses and sanitizes provider errors", async () => {
  const input = { apiKey: "secret", model: "test", signal: AbortSignal.timeout(1000), messages: [] };
  await assert.rejects(completeAnthropic(input, async () => Response.json({ stop_reason: "max_tokens", content: [] })), /incomplete/);
  await assert.rejects(completeAnthropic(input, async () => new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "Invalid schema" } }), { status: 400, headers: { "request-id": "req_safe" } })), (error: unknown) => {
    assert.ok(error instanceof AnthropicProviderError);
    assert.equal(error.status, 400);
    assert.equal(error.errorType, "invalid_request_error");
    assert.equal(error.requestId, "req_safe");
    assert.doesNotMatch(error.message, /Invalid schema/);
    return true;
  });
});

test("Anthropic rewrites nullable type arrays to supported anyOf schemas", () => {
  assert.deepEqual(anthropicProviderSchema({ type: ["string", "null"], maxLength: 4 }), { anyOf: [{ type: "string" }, { type: "null" }] });
});

test("Anthropic retains safe usage when a response is incomplete", async () => {
  await assert.rejects(completeAnthropicWithDetails({ apiKey: "secret", model: "test", signal: AbortSignal.timeout(1000), messages: [] }, async () => Response.json({ stop_reason: "max_tokens", content: [], usage: { input_tokens: 17, output_tokens: 9, cache_read_input_tokens: 3 } })), (error: unknown) => {
    assert.ok(error instanceof AnthropicIncompleteResponseError);
    assert.equal(error.stopReason, "max_tokens");
    assert.deepEqual(error.usage, { inputTokens: 17, outputTokens: 9, cacheReadTokens: 3, cacheWriteTokens: undefined });
    return true;
  });
});
