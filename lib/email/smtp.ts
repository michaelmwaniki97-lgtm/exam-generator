import "server-only";

import nodemailer from "nodemailer";

export type PasswordResetEmailInput = Readonly<{
  to: string;
  resetUrl: string;
}>;

type SmtpConfig = Readonly<{
  url: string;
  from: string;
  requireTls: boolean;
}>;

function requiredEnvironment(
  environment: Record<string, string | undefined>,
  name: "SMTP_URL" | "AUTH_EMAIL_FROM",
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required when Better Auth password recovery is enabled.`);
  if (/\r|\n/.test(value)) throw new Error(`${name} contains an invalid line break.`);
  return value;
}

export function getSmtpConfigForEnvironment(
  environment: Record<string, string | undefined>,
): SmtpConfig {
  const rawUrl = requiredEnvironment(environment, "SMTP_URL");
  const from = requiredEnvironment(environment, "AUTH_EMAIL_FROM");
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("SMTP_URL must be a valid smtp:// or smtps:// URL.");
  }
  if (parsed.protocol !== "smtp:" && parsed.protocol !== "smtps:") {
    throw new Error("SMTP_URL must use smtp:// or smtps://.");
  }
  if (environment.NODE_ENV === "production") {
    const ignoreTls = parsed.searchParams.get("ignoreTLS")?.toLowerCase() === "true";
    const rejectUnauthorized = parsed.searchParams.get("tls.rejectUnauthorized")?.toLowerCase();
    if (ignoreTls || rejectUnauthorized === "false") {
      throw new Error("SMTP_URL cannot disable TLS or certificate validation in production.");
    }
  }
  return {
    url: rawUrl,
    from,
    requireTls: environment.NODE_ENV === "production" && parsed.protocol === "smtp:",
  };
}

export function getSmtpConfig(): SmtpConfig {
  return getSmtpConfigForEnvironment(process.env);
}

export function assertPasswordResetEmailConfigured(): void {
  getSmtpConfig();
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const config = getSmtpConfig();
  const resetUrl = new URL(input.resetUrl);
  const configuredBaseUrl = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  if (resetUrl.origin !== configuredBaseUrl.origin) {
    throw new Error("Better Auth password reset URL origin did not match BETTER_AUTH_URL.");
  }

  const transport = nodemailer.createTransport({
    url: config.url,
    requireTLS: config.requireTls,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({
    from: config.from,
    to: input.to,
    subject: "Reset your Exam Generator password",
    text: [
      "We received a request to reset your Exam Generator password.",
      "",
      `Reset your password: ${input.resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}
