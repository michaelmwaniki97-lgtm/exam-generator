import { Pool } from "pg";
import {
  assertBetterAuthTrafficEnvironment,
  isBetterAuthTrafficReady,
  readBetterAuthTrafficReadiness,
} from "../lib/better-auth/cutover-readiness.ts";

async function main() {
  assertBetterAuthTrafficEnvironment(process.env);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const readiness = await readBetterAuthTrafficReadiness(pool);
    console.log(JSON.stringify({
      ready: isBetterAuthTrafficReady(readiness),
      readiness,
    }, null, 2));
    if (!isBetterAuthTrafficReady(readiness)) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Better Auth cutover readiness check failed.");
  process.exitCode = 1;
});
