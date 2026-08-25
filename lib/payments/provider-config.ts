import "server-only";
import type { PaymentProvider } from "./core";
import { DarajaPaymentProvider, loadDarajaConfig } from "./daraja";
import { logDarajaTelemetry } from "./telemetry";

export type PaymentProviderMode = "unconfigured" | "daraja";
export type PublicPaymentProviderState = { configured: boolean; provider: "M-Pesa"; environment: "sandbox" | "production" | null };
let provider: PaymentProvider | null = null;

export function paymentProviderState(): PublicPaymentProviderState {
  try { const config = loadDarajaConfig(process.env); return { configured: true, provider: "M-Pesa", environment: config.environment }; }
  catch { return { configured: false, provider: "M-Pesa", environment: null }; }
}

export function configuredPaymentProvider(): PaymentProvider {
  if (!provider) {
    try { provider = new DarajaPaymentProvider(loadDarajaConfig(process.env)); }
    catch (error) {
      logDarajaTelemetry({ stage: "config", event: "terminal_failure", classification: "config" });
      throw error;
    }
  }
  return provider;
}
