import { describe, expect, it } from "vitest";
import { aggregateUsageAnalytics } from "./analytics";

describe("analytics", () => {
  it("agrega consumo por capability e dia sem aceitar quantidades inválidas", () => {
    expect(aggregateUsageAnalytics([
      { capability: "lead_search", quantity: 2, created_at: "2026-09-12T10:00:00Z" },
      { capability: "lead_search", quantity: "3", created_at: "2026-09-12T11:00:00Z" },
      { capability: "voice_ai", quantity: -4, created_at: "2026-09-13T11:00:00Z" },
      { capability: null, quantity: null, created_at: "2026-09-13T12:00:00Z" },
    ])).toEqual({ total: 5, byCapability: { lead_search: 5, voice_ai: 0, unknown: 0 }, byDay: { "2026-09-12": { lead_search: 5 }, "2026-09-13": { voice_ai: 0, unknown: 0 } } });
  });
});
