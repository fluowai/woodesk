import { describe, expect, it } from "vitest";
import { featureEnabled, isWoodeskFeatureFlag } from "./feature-flags";

describe("Woodesk feature flags", () => {
  it("accepts only declared flags and defaults closed", () => {
    expect(isWoodeskFeatureFlag("lead_finder")).toBe(true);
    expect(isWoodeskFeatureFlag("analytics")).toBe(true);
    expect(isWoodeskFeatureFlag("unknown_integration")).toBe(false);
    expect(featureEnabled("voice_ai", {})).toBe(false);
    expect(featureEnabled("voice_ai", { voice_ai: true })).toBe(true);
  });
});
