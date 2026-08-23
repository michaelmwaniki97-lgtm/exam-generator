import "server-only";
import type { PaymentProvider } from "./core";
import { PaymentError } from "./core";

export type PaymentProviderMode = "unconfigured" | "daraja";
export type PublicPaymentProviderState = { configured: boolean; provider: "M-Pesa"; environment: "sandbox" | "production" | null };

export function paymentProviderState(): PublicPaymentProviderState {
  const mode = process.env.PAYMENT_PROVIDER;
  const environment = process.env.PAYMENT_PROVIDER_ENVIRONMENT;
  if (mode !== "daraja" || (environment !== "sandbox" && environment !== "production")) return { configured: false, provider: "M-Pesa", environment: null };
  // Phase 11B will validate the complete, officially documented credential set.
  return { configured: false, provider: "M-Pesa", environment };
}

export function configuredPaymentProvider(): PaymentProvider {
  throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured yet.");
}
