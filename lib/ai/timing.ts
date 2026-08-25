export const AI_OPERATION_TIMING = {
  serverActionMaximumSeconds: 300,
  providerTimeoutMs: 120_000,
  generationBudgetMs: 270_000,
  groundingTimeoutMs: 90_000,
  regenerationProviderTimeoutMs: 120_000,
  regenerationBudgetMs: 150_000,
  leaseSafetyMarginMs: 30_000,
} as const;

export const REGENERATION_LEASE_SECONDS =
  AI_OPERATION_TIMING.serverActionMaximumSeconds +
  Math.ceil(AI_OPERATION_TIMING.leaseSafetyMarginMs / 1_000);
