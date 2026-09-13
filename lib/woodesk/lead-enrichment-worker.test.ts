import { describe, expect, it } from "vitest";

import { createLeadEnrichmentHandler, extractWebsiteEvidence } from "./lead-enrichment-worker";

describe("lead enrichment worker", () => {
  it("returns a handler with the queue contract", () => {
    expect(typeof createLeadEnrichmentHandler()).toBe("function");
  });

  it("extracts bounded website evidence without inventing performance scores", () => {
    const evidence = extractWebsiteEvidence('<html><head><title>Clínica Aurora</title><meta name="viewport" content="width=device-width"></head><body>contato@aurora.example https://instagram.com/aurora https://facebook.com/aurora</body></html>', 200, 123);
    expect(evidence).toMatchObject({ title: "Clínica Aurora", hasViewport: true, httpStatus: 200, responseMs: 123, facebook: "https://facebook.com/aurora", instagram: "https://instagram.com/aurora" });
    expect(evidence.emails).toEqual(["contato@aurora.example"]);
    expect(evidence.htmlBytes).toBeGreaterThan(0);
  });
});
