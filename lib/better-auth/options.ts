import "server-only";

import { nextCookies } from "better-auth/next-js";
import { sendPasswordResetEmail } from "../email/smtp.ts";
import { hashMigrationPassword, verifyMigrationPassword } from "./password-migration.ts";
import { getBetterAuthPool } from "./pool.ts";

function required(name: "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when AUTH_BACKEND=better-auth.`);
  if (name === "BETTER_AUTH_SECRET" && value.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  return value;
}

export function buildBetterAuthOptions() {
  return {
    appName: "Exam Generator",
    baseURL: required("BETTER_AUTH_URL"),
    secret: required("BETTER_AUTH_SECRET"),
    database: getBetterAuthPool(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      password: {
        hash: hashMigrationPassword,
        verify: verifyMigrationPassword,
      },
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        // Better Auth recommends not awaiting delivery here to reduce account-
        // enumeration timing differences. This app runs as a long-lived VPS
        // process, so the SMTP send can continue after the API response.
        void sendPasswordResetEmail({ to: user.email, resetUrl: url }).catch(() => {
          console.error("Better Auth password-reset email delivery failed.");
        });
      },
    },
    user: {
      modelName: "users",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      modelName: "sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    account: {
      modelName: "accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        idToken: "id_token",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      modelName: "verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    plugins: [nextCookies()],
    advanced: {
      database: {
        generateId: "uuid" as const,
      },
      cookiePrefix: "exam_generator",
    },
  };
}
