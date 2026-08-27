import { Pool } from "pg";
import {
  assertAuthCutoverConfiguration,
  getAuthCutoverState,
} from "../lib/auth-backend/cutover-state.ts";
import {
  assertBetterAuthTrafficEnvironment,
  isBetterAuthAcceptedReady,
  readBetterAuthTrafficReadiness,
} from "../lib/better-auth/cutover-readiness.ts";

async function main() {
  assertAuthCutoverConfiguration(process.env);
  if (getAuthCutoverState(process.env) !== "accepted") {
    throw new Error("AUTH_CUTOVER_STATE=accepted is required for the final Better Auth acceptance check.");
  }
  assertBetterAuthTrafficEnvironment(process.env);

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString });
  try {
    const readiness = await readBetterAuthTrafficReadiness(pool);
    const acceptedReady = isBetterAuthAcceptedReady(readiness);
    console.log(JSON.stringify({
      cutoverState: "accepted",
      acceptedReady,
      historicalUsersMissingBetterAuth: readiness.historicalUsersMissingBetterAuth,
      normalizedEmailMismatches: readiness.normalizedEmailMismatches,
      missingTeacherUsers: readiness.missingTeacherUsers,
      missingAdminUsers: readiness.missingAdminUsers,
      missingUploaderUsers: readiness.missingUploaderUsers,
      reviewedForeignKeys: readiness.reviewedForeignKeys,
      legacySignupTriggerPresent: readiness.legacySignupTriggerPresent,
      legacyServiceRoleHistoricalRead: readiness.serviceRoleCanReadHistoricalUsers,
      legacyServiceRoleHistoricalInsert: readiness.serviceRoleCanInsertHistoricalUsers,
      authenticatedRlsCompatibility: readiness.authenticatedCanUseAuthSchema && readiness.authenticatedCanExecuteAuthUid,
      postAcceptanceBetterAuthOnlyUsersAllowed: true,
    }, null, 2));
    if (!acceptedReady) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Better Auth finalization check failed.");
  process.exitCode = 1;
});
