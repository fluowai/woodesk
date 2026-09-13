import { describe, expect, it } from "vitest";
import { resolveCapabilityHealth } from "./health";

describe("Woodesk capability health", () => {
  it("resolves provider-backed and configuration-backed states", () => {
    const result = resolveCapabilityHealth({ enabledFlags: new Set(["lead_finder", "google_business", "omnichannel"]), placesReady: true, activeGoogleBusinessLocations: 1 });
    expect(result.lead_search).toEqual({ enabled: true, status: "ready" });
    expect(result.google_business).toEqual({ enabled: true, status: "ready" });
    expect(result.omnichannel).toEqual({ enabled: true, status: "ready" });
  });

  it("distinguishes pending providers from disabled capabilities", () => {
    const result = resolveCapabilityHealth({ enabledFlags: new Set(["marketing_calendar", "google_business"]), placesReady: false, activeGoogleBusinessLocations: 0 });
    expect(result.content_generation).toEqual({ enabled: true, status: "provider_pending" });
    expect(result.google_business).toEqual({ enabled: true, status: "not_configured" });
    expect(result.voice_ai).toEqual({ enabled: false, status: "disabled" });
  });
});
