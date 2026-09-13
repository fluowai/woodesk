export type ProviderHealthStatus = "healthy" | "degraded" | "unavailable";

export interface ProviderHealthSample {
  providerId: string;
  status: ProviderHealthStatus;
  latencyMs?: number;
  checkedAt?: string;
  reason?: string;
}

export interface ProviderHealthSummary {
  status: ProviderHealthStatus;
  available: boolean;
  samples: readonly ProviderHealthSample[];
}

const RANK: Record<ProviderHealthStatus, number> = {
  healthy: 0,
  degraded: 1,
  unavailable: 2,
};

export function summarizeProviderHealth(
  samples: readonly ProviderHealthSample[],
): ProviderHealthSummary {
  const validSamples = samples.filter(
    (sample) => sample.providerId.trim().length > 0 && sample.status in RANK,
  );

  if (validSamples.length === 0) {
    return { status: "unavailable", available: false, samples: [] };
  }

  const status = validSamples.reduce<ProviderHealthStatus>(
    (worst, sample) => (RANK[sample.status] > RANK[worst] ? sample.status : worst),
    "healthy",
  );

  return {
    status,
    available: status !== "unavailable",
    samples: validSamples,
  };
}

export function providerCanExecute(summary: ProviderHealthSummary): boolean {
  return summary.available && summary.samples.length > 0;
}
