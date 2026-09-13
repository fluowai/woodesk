import { describe, expect, it } from "vitest";
import { normalizeGoogleBusinessSnapshot } from "./google-business";

describe("Google Business metrics", () => {
  it("accepts an official normalized snapshot", () => {
    const metrics = { mapsDesktopImpressions: 1, mapsMobileImpressions: 2, searchDesktopImpressions: 3, searchMobileImpressions: 4, phoneClicks: 5, websiteClicks: 6, directionRequests: 7, messages: 8 };
    expect(normalizeGoogleBusinessSnapshot({ locationResourceName: "locations/123", periodStart: "2026-09-01", periodEnd: "2026-09-12", metrics, source: "google_business_profile_performance" })).toMatchObject({ locationResourceName: "locations/123", metrics });
  });

  it("rejects invalid location resources and negative metrics", () => {
    const metrics = { mapsDesktopImpressions: -1, mapsMobileImpressions: 0, searchDesktopImpressions: 0, searchMobileImpressions: 0, phoneClicks: 0, websiteClicks: 0, directionRequests: 0, messages: 0 };
    expect(() => normalizeGoogleBusinessSnapshot({ locationResourceName: "123", periodStart: "2026-09-01", periodEnd: "2026-09-12", metrics, source: "google_business_profile_performance" })).toThrow("google_business_location_invalid");
  });

  it("calls the official endpoint and aggregates daily values", async () => {
    let calledUrl = "";
    const response = { ok: true, status: 200, json: async () => ({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [{ dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [{ value: "2" }, { value: "3" }] } }] }] }) } as Response;
    const { fetchGoogleBusinessMetrics } = await import("./google-business");
    const result = await fetchGoogleBusinessMetrics({ accessToken: "secret", locationResourceName: "locations/123", periodStart: "2026-09-01", periodEnd: "2026-09-12", fetchImpl: async (url) => { calledUrl = String(url); return response; } });
    expect(result.metrics.phoneClicks).toBe(5);
    expect(calledUrl).toContain("businessprofileperformance.googleapis.com/v1/locations/123");
    expect(calledUrl).toContain("dailyMetrics=CALL_CLICKS");
  });
});
