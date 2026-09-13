import { describe, expect, it } from "vitest";
import { providerCanExecute, summarizeProviderHealth } from "./provider-health";

describe("provider health", () => {
  it("fails closed when there are no valid provider samples", () => {
    const summary = summarizeProviderHealth([]);

    expect(summary.status).toBe("unavailable");
    expect(providerCanExecute(summary)).toBe(false);
  });

  it("propagates the worst provider state", () => {
    const summary = summarizeProviderHealth([
      { providerId: "google", status: "healthy" },
      { providerId: "waha", status: "degraded", reason: "latency" },
    ]);

    expect(summary.status).toBe("degraded");
    expect(providerCanExecute(summary)).toBe(true);
  });

  it("blocks execution when any provider is unavailable", () => {
    const summary = summarizeProviderHealth([
      { providerId: "google", status: "healthy" },
      { providerId: "waha", status: "unavailable" },
    ]);

    expect(summary.status).toBe("unavailable");
    expect(providerCanExecute(summary)).toBe(false);
  });
});
