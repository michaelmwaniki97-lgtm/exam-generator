import { parseDarajaCallback } from "@/lib/payments/daraja";
import { processDarajaCallback } from "@/lib/payments/daraja-service";
import { configuredPaymentProvider } from "@/lib/payments/provider-config";
import { ServerPaymentRepository } from "@/lib/payments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BODY_LIMIT = 32_768;

async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" || !request.body) throw new Error("invalid");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_LIMIT) throw new Error("invalid");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > BODY_LIMIT) { await reader.cancel(); throw new Error("invalid"); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request) {
  let callback;
  try { callback = parseDarajaCallback(await readBody(request)); }
  catch { return Response.json({ received: false }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  try {
    await processDarajaCallback({ callback, repository: new ServerPaymentRepository(), provider: configuredPaymentProvider() });
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ received: false }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
