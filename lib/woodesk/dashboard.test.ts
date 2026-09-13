import { describe, expect, it } from "vitest";
import { buildWoodeskDashboardMetrics } from "./dashboard";

describe("Woodesk dashboard metrics", () => {
  it("computes current, previous and percentage change", () => {
    const metrics = buildWoodeskDashboardMetrics({
      leadsFound: 15,
      meetingsScheduled: 6,
      opportunities: 0,
      salesCents: 12000,
      contentsGenerated: 3,
      voiceCalls: 4,
      previous: { leadsFound: 10, meetingsScheduled: 6, salesCents: 0 },
    });

    expect(metrics.leadsFound).toEqual({ value: 15, previousValue: 10, changePercent: 50 });
    expect(metrics.meetingsScheduled.changePercent).toBe(0);
    expect(metrics.salesCents.changePercent).toBeNull();
  });

  it("normalizes invalid and negative counters", () => {
    const metrics = buildWoodeskDashboardMetrics({
      leadsFound: -2,
      meetingsScheduled: Number.NaN,
      opportunities: 1,
      salesCents: 0,
      contentsGenerated: 0,
      voiceCalls: 0,
      previous: { leadsFound: -1 },
    });

    expect(metrics.leadsFound.value).toBe(0);
    expect(metrics.meetingsScheduled.value).toBe(0);
  });
});
