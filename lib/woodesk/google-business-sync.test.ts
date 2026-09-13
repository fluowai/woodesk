import { describe, expect, it } from "vitest";
import { persistGoogleBusinessSnapshot, type GoogleBusinessDb } from "./google-business-sync";

describe("Google Business snapshot persistence", () => {
  it("upserts by location, period and source and keeps tenant filters", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const db: GoogleBusinessDb = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
    await persistGoogleBusinessSnapshot(db, {
      organizationId: "org-1", locationId: "loc-1", locationResourceName: "locations/123",
      periodStart: "2026-09-01", periodEnd: "2026-09-12",
      metrics: { mapsDesktopImpressions: 1, mapsMobileImpressions: 2, searchDesktopImpressions: 3, searchMobileImpressions: 4, phoneClicks: 5, websiteClicks: 6, directionRequests: 7, messages: 8 },
      source: "google_business_profile_performance",
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.sql).toContain("on conflict (location_id, period_start, period_end, source)");
    expect(calls[0]?.sql).toContain("organization_id = $1");
    expect(calls[1]?.sql).toContain("where id = $1 and organization_id = $2");
  });
});
