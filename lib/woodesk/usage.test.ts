import { describe, expect, it } from "vitest";
import { aggregateUsage, aggregateUsageHistory, usagePeriodStart } from "./usage";

describe("Woodesk usage metering", () => {
  it("uses a stable UTC monthly bucket", () => {
    expect(usagePeriodStart(new Date("2026-09-12T23:59:00.000Z"))).toBe("2026-09-01");
    expect(usagePeriodStart(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01-01");
  });

  it("aggregates capability quantities and ignores invalid values", () => {
    expect(aggregateUsage([{ capability: "voice_ai", quantity: 2 }, { capability: "voice_ai", quantity: 3 }, { capability: "lead_search", quantity: null }, { capability: "lead_search", quantity: -1 }])).toEqual({ voice_ai: 5, lead_search: 0 });
  });

  it("keeps monthly history separated by period", () => {
    expect(aggregateUsageHistory([{ period_start: "2026-08-01", capability: "voice_ai", quantity: 2 }, { period_start: "2026-09-01", capability: "voice_ai", quantity: 1 }])).toEqual({ "2026-08-01": { voice_ai: 2 }, "2026-09-01": { voice_ai: 1 } });
  });
});
