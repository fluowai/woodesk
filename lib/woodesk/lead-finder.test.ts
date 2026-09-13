import { describe, expect, it } from "vitest";
import { filterLeadResults, normalizeLeadResult, normalizePhone, scoreLead } from "./lead-finder";

describe("lead finder", () => {
  it("normalizes phone digits without claiming WhatsApp", () => {
    expect(normalizePhone("+55 (41) 99999-1234")).toBe("5541999991234");
    expect(normalizeLeadResult({ name: "  Clínica Sorriso  ", phone: "+55 (41) 99999-1234" })).toMatchObject({
      name: "Clínica Sorriso", normalizedPhone: "5541999991234", hasWhatsapp: null,
    });
  });

  it("scores only signals that were supplied", () => {
    expect(scoreLead({ hasWebsite: false, rating: 3.8, reviewCount: 4, localRank: 18, instagramQuality: "poor", postingFrequency: "low" })).toEqual({
      score: 85, band: "high", reasons: ["sem site", "nota abaixo de 4", "poucas avaliações", "ranking local baixo", "Instagram fraco", "baixa frequência de posts"],
    });
  });

  it("filters normalized results without treating unknown signals as matches", () => {
    const results = [
      normalizeLeadResult({ name: "Com site", website: "https://example.com", rating: 4.5, reviewCount: 30 }),
      normalizeLeadResult({ name: "Sem site", rating: 3.9, reviewCount: 2 }),
    ];
    expect(filterLeadResults(results, { minimumRating: 4, hasWebsite: true }).map((result) => result.name)).toEqual(["Com site"]);
    expect(filterLeadResults(results, { hasWhatsapp: true })).toEqual([]);
  });
});
