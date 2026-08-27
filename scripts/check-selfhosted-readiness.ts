import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { auditSelfHostedDependencies, isSelfHostedDependencyReady } from "../lib/self-hosted/dependency-audit.ts";
import { assertSelfHostedRuntimeEnvironment } from "../lib/self-hosted/readiness.ts";

async function main() {
  const root = process.cwd();
  const environment = assertSelfHostedRuntimeEnvironment(process.env);
  const dependencyAudit = await auditSelfHostedDependencies(root);
  if (!isSelfHostedDependencyReady(dependencyAudit)) {
    throw new Error("Self-hosted runtime still contains direct Supabase application dependencies.");
  }

  const storage = await stat(environment.storageRoot).catch(() => null);
  if (!storage?.isDirectory()) throw new Error("TEXTBOOK_STORAGE_ROOT must exist as a private directory before deployment acceptance.");

  const report = {
    environmentReady: true,
    databaseBackend: environment.databaseBackend,
    authBackend: environment.authBackend,
    authCutoverState: environment.authCutoverState,
    storageBackend: environment.storageBackend,
    storageRootAbsolute: path.isAbsolute(environment.storageRoot),
    aiProvider: environment.aiProvider,
    paymentProvider: environment.paymentProvider,
    paymentEnvironment: environment.paymentEnvironment,
    legacySupabaseSecretsPresent: environment.legacySupabaseSecretsPresent,
    directAppSupabaseImports: dependencyAudit.directAppSupabaseImports.length,
    directRuntimeDataCalls: dependencyAudit.directRuntimeDataCalls.length,
    directRuntimeStorageCalls: dependencyAudit.directRuntimeStorageCalls.length,
    directRuntimeAuthCalls: dependencyAudit.directRuntimeAuthCalls.length,
    fallbackAdaptersRetained: dependencyAudit.fallbackAdapterFiles.length,
    maintenanceSupabaseScriptsRetained: dependencyAudit.maintenanceSupabaseScripts.length,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Self-hosted readiness check failed.");
  process.exitCode = 1;
});
