import { describe, expect, it } from "vitest";
import { generateLeadDiagnostic } from "./diagnostic";

describe("lead diagnostic", () => {
  it("turns lead signals into actionable output", () => {
    const result = generateLeadDiagnostic("Clínica Sorriso", {
      hasWebsite: false,
      rating: 3.8,
      reviewCount: 4,
      localRank: 18,
      instagramQuality: "poor",
      postingFrequency: "low",
    });

    expect(result.score).toBe(85);
    expect(result.scoreBand).toBe("high");
    expect(result.problems.length).toBeGreaterThan(2);
    expect(result.pitch).toContain("Clínica Sorriso");
  });

  it("rejects a missing business name", () => {
    expect(() => generateLeadDiagnostic(" ", { hasWebsite: true })).toThrow("diagnostic_business_required");
  });
});
