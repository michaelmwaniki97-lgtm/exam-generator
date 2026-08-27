import path from "node:path";

export type SelfHostedAiProvider = "openai" | "groq" | "nvidia";
export type SelfHostedPaymentEnvironment = "sandbox" | "production";

export type SelfHostedRuntimeReadiness = Readonly<{
  databaseBackend: "postgres";
  authBackend: "better-auth";
  authCutoverState: "accepted";
  authMutationMode: "normal";
  storageBackend: "filesystem";
  storageRoot: string;
  aiProvider: SelfHostedAiProvider;
  paymentProvider: "daraja";
  paymentEnvironment: SelfHostedPaymentEnvironment;
  legacySupabaseSecretsPresent: boolean;
}>;

type Environment = Record<string, string | undefined>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for the self-hosted runtime.`);
  if (/\r|\n/.test(value)) throw new Error(`${name} contains an invalid line break.`);
  return value;
}

function requiredChoice<T extends string>(environment: Environment, name: string, allowed: readonly T[]): T {
  const value = required(environment, name).toLowerCase();
  if (!allowed.includes(value as T)) throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}

function cleanApplicationUrl(environment: Environment, name: string): URL {
  let url: URL;
  try { url = new URL(required(environment, name)); }
  catch { throw new Error(`${name} must be a valid HTTP(S) URL.`); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error(`${name} must be a clean HTTP(S) application URL.`);
  }
  if (url.pathname !== "/") throw new Error(`${name} must use the application origin without a path.`);
  if (environment.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url;
}

function assertDatabaseUrl(environment: Environment): void {
  let url: URL;
  try { url = new URL(required(environment, "DATABASE_URL")); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL."); }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  }
}

function assertStorageRoot(environment: Environment): string {
  const root = required(environment, "TEXTBOOK_STORAGE_ROOT");
  if (!path.isAbsolute(root)) throw new Error("TEXTBOOK_STORAGE_ROOT must be an absolute private directory.");
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root) throw new Error("TEXTBOOK_STORAGE_ROOT cannot be the filesystem root.");
  return resolved;
}

function assertSmtp(environment: Environment): void {
  let url: URL;
  try { url = new URL(required(environment, "SMTP_URL")); }
  catch { throw new Error("SMTP_URL must be a valid smtp:// or smtps:// URL."); }
  if (url.protocol !== "smtp:" && url.protocol !== "smtps:") {
    throw new Error("SMTP_URL must use smtp:// or smtps://.");
  }
  if (environment.NODE_ENV === "production") {
    if (url.searchParams.get("ignoreTLS")?.toLowerCase() === "true"
      || url.searchParams.get("tls.rejectUnauthorized")?.toLowerCase() === "false") {
      throw new Error("SMTP_URL cannot disable TLS or certificate validation in production.");
    }
  }
  required(environment, "AUTH_EMAIL_FROM");
}

function assertAi(environment: Environment): SelfHostedAiProvider {
  const provider = requiredChoice(environment, "AI_PROVIDER", ["openai", "groq", "nvidia"] as const);
  const keyName = provider === "openai" ? "OPENAI_API_KEY" : provider === "groq" ? "GROQ_API_KEY" : "NVIDIA_API_KEY";
  required(environment, keyName);
  return provider;
}

function assertDaraja(environment: Environment, appUrl: URL): SelfHostedPaymentEnvironment {
  const provider = requiredChoice(environment, "PAYMENT_PROVIDER", ["daraja"] as const);
  void provider;
  const paymentEnvironment = requiredChoice(environment, "MPESA_ENVIRONMENT", ["sandbox", "production"] as const);
  const transactionType = required(environment, "MPESA_TRANSACTION_TYPE");
  if (transactionType !== "CustomerPayBillOnline" && transactionType !== "CustomerBuyGoodsOnline") {
    throw new Error("MPESA_TRANSACTION_TYPE must be CustomerPayBillOnline or CustomerBuyGoodsOnline.");
  }
  for (const name of [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_BUSINESS_SHORTCODE",
    "MPESA_PARTY_B",
    "MPESA_PASSKEY",
  ]) required(environment, name);

  if (appUrl.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS when Daraja is enabled.");
  if (paymentEnvironment === "production") {
    let queryUrl: URL;
    try { queryUrl = new URL(required(environment, "MPESA_QUERY_URL")); }
    catch { throw new Error("MPESA_QUERY_URL must be a valid HTTPS URL in production."); }
    if (queryUrl.protocol !== "https:" || queryUrl.hostname !== "api.safaricom.co.ke" || queryUrl.username || queryUrl.password || queryUrl.hash) {
      throw new Error("MPESA_QUERY_URL must use the verified api.safaricom.co.ke HTTPS host in production.");
    }
  }
  return paymentEnvironment;
}

export function assertSelfHostedRuntimeEnvironment(environment: Environment = process.env): SelfHostedRuntimeReadiness {
  if (requiredChoice(environment, "DATABASE_BACKEND", ["postgres"] as const) !== "postgres") throw new Error("DATABASE_BACKEND=postgres is required.");
  assertDatabaseUrl(environment);
  if (requiredChoice(environment, "AUTH_BACKEND", ["better-auth"] as const) !== "better-auth") throw new Error("AUTH_BACKEND=better-auth is required.");
  if (requiredChoice(environment, "AUTH_CUTOVER_STATE", ["accepted"] as const) !== "accepted") throw new Error("AUTH_CUTOVER_STATE=accepted is required.");
  if (requiredChoice(environment, "AUTH_MUTATION_MODE", ["normal"] as const) !== "normal") throw new Error("AUTH_MUTATION_MODE=normal is required.");
  if (required(environment, "BETTER_AUTH_SECRET").length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

  const appUrl = cleanApplicationUrl(environment, "PUBLIC_APP_URL");
  const authUrl = cleanApplicationUrl(environment, "BETTER_AUTH_URL");
  if (appUrl.origin !== authUrl.origin) throw new Error("PUBLIC_APP_URL and BETTER_AUTH_URL must use the same origin.");
  assertSmtp(environment);

  const storageBackend = requiredChoice(environment, "TEXTBOOK_STORAGE_BACKEND", ["filesystem"] as const);
  const storageRoot = assertStorageRoot(environment);
  const aiProvider = assertAi(environment);
  const paymentEnvironment = assertDaraja(environment, appUrl);

  return {
    databaseBackend: "postgres",
    authBackend: "better-auth",
    authCutoverState: "accepted",
    authMutationMode: "normal",
    storageBackend,
    storageRoot,
    aiProvider,
    paymentProvider: "daraja",
    paymentEnvironment,
    legacySupabaseSecretsPresent: Boolean(
      environment.NEXT_PUBLIC_SUPABASE_URL?.trim()
      || environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
      || environment.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
  };
}
