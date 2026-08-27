import "server-only";

import { assertAuthRollbackWindowFrozen } from "../lib/auth-backend/cutover-mode.ts";
import { getBetterAuthPool } from "../lib/better-auth/pool.ts";
import {
  assertBetterAuthTrafficEnvironment,
  isBetterAuthTrafficReady,
  readBetterAuthTrafficReadiness,
} from "../lib/better-auth/cutover-readiness.ts";

async function main() {
  assertAuthRollbackWindowFrozen(process.env);
  assertBetterAuthTrafficEnvironment(process.env);

  const readiness = await readBetterAuthTrafficReadiness(getBetterAuthPool());
  const ready = isBetterAuthTrafficReady(readiness);

  console.log(JSON.stringify({
    rollbackWindowFrozen: true,
    trafficReady: ready,
    historicalUsersMissingBetterAuth: readiness.historicalUsersMissingBetterAuth,
    betterAuthUsersMissingHistorical: readiness.betterAuthUsersMissingHistorical,
    normalizedEmailMismatches: readiness.normalizedEmailMismatches,
    missingTeacherUsers: readiness.missingTeacherUsers,
    missingAdminUsers: readiness.missingAdminUsers,
    missingUploaderUsers: readiness.missingUploaderUsers,
    reviewedForeignKeys: readiness.reviewedForeignKeys,
    legacySignupTriggerPresent: readiness.legacySignupTriggerPresent,
    serviceRoleCanReadHistoricalUsers: readiness.serviceRoleCanReadHistoricalUsers,
    serviceRoleCanInsertHistoricalUsers: readiness.serviceRoleCanInsertHistoricalUsers,
    authenticatedCanUseAuthSchema: readiness.authenticatedCanUseAuthSchema,
    authenticatedCanExecuteAuthUid: readiness.authenticatedCanExecuteAuthUid,
  }));

  if (!ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Auth rollback-window check failed.");
  process.exitCode = 1;
});
