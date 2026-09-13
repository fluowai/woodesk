import { describe, expect, it } from "vitest";

import { createBrowserImportProvider, normalizeBrowserLead } from "./browser-import";

describe("browser import provider", () => {
  it("stays disabled until a browser extractor submits data", async () => {
    const provider = createBrowserImportProvider();

    expect(provider.id).toBe("browser_import");
    expect(provider.enabled).toBe(false);
    await expect(provider.healthCheck()).resolves.toMatchObject({
      providerId: "browser_import",
      status: "disabled",
      message: expect.stringContaining("extractor"),
    });
  });

  it("normalizes extractor fields into the lead result contract", () => {
    expect(
      normalizeBrowserLead({
        name: " Loja Exemplo ",
        phone: "+55 (11) 99999-0000",
        rating: 4.8,
        reviewCount: 12,
        sourceUrl: "https://maps.google.com/?cid=123",
      }),
    ).toMatchObject({
      name: "Loja Exemplo",
      phone: "+55 (11) 99999-0000",
      normalizedPhone: "5511999990000",
      rating: 4.8,
      reviewCount: 12,
      sourceUrl: "https://maps.google.com/?cid=123",
    });
  });
});
