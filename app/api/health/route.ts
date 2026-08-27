import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/db/postgres-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (process.env.DATABASE_BACKEND?.trim().toLowerCase() === "postgres") {
      await getPostgresPool().query("select 1");
    }
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
