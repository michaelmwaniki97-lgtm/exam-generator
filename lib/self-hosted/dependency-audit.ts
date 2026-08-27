import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type SelfHostedDependencyAudit = Readonly<{
  directAppSupabaseImports: string[];
  directRuntimeDataCalls: string[];
  directRuntimeStorageCalls: string[];
  directRuntimeAuthCalls: string[];
  maintenanceSupabaseScripts: string[];
  fallbackAdapterFiles: string[];
}>;

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const APPROVED_LEGACY_AUTH_FILES = new Set([
  "app/auth/callback/route.ts",
  "lib/auth-backend/supabase.ts",
  "lib/supabase/middleware.ts",
]);

async function sourceFiles(root: string, relativeDirectory: string): Promise<string[]> {
  const directory = path.join(root, relativeDirectory);
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.includes(".test.") && !entry.name.includes(".integration.test.")) out.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    }
  }
  await walk(directory);
  return out;
}

function isFallbackAdapter(file: string): boolean {
  return file.startsWith("lib/") && file.endsWith("/supabase.ts");
}

function isSupabaseInfrastructure(file: string): boolean {
  return file.startsWith("lib/supabase/") || isFallbackAdapter(file) || file === "lib/db/supabase-rpc.ts";
}

export async function auditSelfHostedDependencies(root: string): Promise<SelfHostedDependencyAudit> {
  const runtimeFiles = [
    ...await sourceFiles(root, "app"),
    ...await sourceFiles(root, "components"),
    ...await sourceFiles(root, "lib"),
  ];
  const scriptFiles = await sourceFiles(root, "scripts");

  const directAppSupabaseImports: string[] = [];
  const directRuntimeDataCalls: string[] = [];
  const directRuntimeStorageCalls: string[] = [];
  const directRuntimeAuthCalls: string[] = [];
  const fallbackAdapterFiles: string[] = [];

  for (const file of runtimeFiles) {
    const source = await readFile(path.join(root, file), "utf8");
    if (isFallbackAdapter(file)) fallbackAdapterFiles.push(file);

    if ((file.startsWith("app/") || file.startsWith("components/"))
      && !APPROVED_LEGACY_AUTH_FILES.has(file)
      && /(?:@supabase\/|(?:@\/lib\/|\.\.\/|\.\/)supabase\/)/.test(source)) {
      directAppSupabaseImports.push(file);
    }

    const withoutBuiltInFrom = source.replaceAll("Buffer.from", "").replaceAll("Array.from", "");
    if (!isSupabaseInfrastructure(file) && /\.from\(\s*["'`]/.test(withoutBuiltInFrom)) directRuntimeDataCalls.push(file);
    if (!isSupabaseInfrastructure(file) && /\.storage\s*\./.test(source)) directRuntimeStorageCalls.push(file);
    if (!isSupabaseInfrastructure(file)
      && !APPROVED_LEGACY_AUTH_FILES.has(file)
      && /\.auth\s*\.(?:getUser|signUp|signInWithPassword|signOut|resetPasswordForEmail|updateUser|exchangeCodeForSession)\s*\(/.test(source)) {
      directRuntimeAuthCalls.push(file);
    }
  }

  const maintenanceSupabaseScripts: string[] = [];
  for (const file of scriptFiles) {
    const source = await readFile(path.join(root, file), "utf8");
    if (/@supabase\/supabase-js|supabase\/(?:admin|server|client)/.test(source)) maintenanceSupabaseScripts.push(file);
  }

  const sorted = (values: string[]) => [...new Set(values)].sort();
  return {
    directAppSupabaseImports: sorted(directAppSupabaseImports),
    directRuntimeDataCalls: sorted(directRuntimeDataCalls),
    directRuntimeStorageCalls: sorted(directRuntimeStorageCalls),
    directRuntimeAuthCalls: sorted(directRuntimeAuthCalls),
    maintenanceSupabaseScripts: sorted(maintenanceSupabaseScripts),
    fallbackAdapterFiles: sorted(fallbackAdapterFiles),
  };
}

export function isSelfHostedDependencyReady(audit: SelfHostedDependencyAudit): boolean {
  return audit.directAppSupabaseImports.length === 0
    && audit.directRuntimeDataCalls.length === 0
    && audit.directRuntimeStorageCalls.length === 0
    && audit.directRuntimeAuthCalls.length === 0;
}
