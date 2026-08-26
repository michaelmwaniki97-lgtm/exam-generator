import pg from "pg";

const { Pool } = pg;

function backendName() {
  const configured = process.env.DATABASE_BACKEND?.trim().toLowerCase();
  if (!configured || configured === "supabase") return "supabase";
  if (configured === "postgres") return "postgres";
  throw new Error("DATABASE_BACKEND must be either supabase or postgres.");
}

export async function importVerifiedCurriculum(client, payload) {
  if (backendName() === "supabase") {
    const { data, error } = await client.rpc("import_verified_curriculum", { p_payload: payload });
    if (error) throw new Error(`Transactional import failed: ${error.message}`);
    return data;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required when DATABASE_BACKEND=postgres.");
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000, query_timeout: 15_000, statement_timeout: 15_000, allowExitOnIdle: true });
  const database = await pool.connect();
  try {
    await database.query("begin");
    await database.query("set local role service_role");
    await database.query("select set_config($1, $2, true)", ["request.jwt.claim.role", "service_role"]);
    const result = await database.query("select public.import_verified_curriculum($1::jsonb) as result", [payload]);
    await database.query("commit");
    return result.rows[0]?.result;
  } catch (error) {
    try { await database.query("rollback"); } catch { /* preserve the original error */ }
    throw error;
  } finally {
    database.release();
    await pool.end();
  }
}
