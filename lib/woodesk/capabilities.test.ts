import { describe, expect, it } from "vitest";
import { WoodeskCapabilityRegistry, type WoodeskProvider } from "./capabilities";

const provider = (overrides: Partial<WoodeskProvider> = {}): WoodeskProvider => ({
  id: "provider-a",
  capabilities: ["lead_search"],
  priority: 10,
  enabled: true,
  healthCheck: async () => ({ providerId: "provider-a", status: "healthy", checkedAt: new Date() }),
  ...overrides,
});

describe("WoodeskCapabilityRegistry", () => {
  it("resolve providers only for a capability enabled", () => {
    const registry = new WoodeskCapabilityRegistry([
      provider({ id: "low", priority: 1 }),
      provider({ id: "high", priority: 20 }),
      provider({ id: "disabled", enabled: false, priority: 100 }),
    ]);

    expect(registry.resolve("lead_search").providers.map((item) => item.id)).toEqual(["high", "low"]);
  });

  it("rejects duplicate provider ids", () => {
    expect(() => new WoodeskCapabilityRegistry([provider(), provider()])).toThrow("provider_id_duplicado");
  });
});
