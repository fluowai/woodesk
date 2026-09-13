import { describe, expect, it, vi } from "vitest";

import { createContentPublishHandler, createInstagramContentProvider, createInstagramContentProviderFromResolver, resolveInstagramContentProvider } from "./content-worker";

const job = { organization_id: "org-1", payload: { calendar_item_id: "item-1" } } as never;

describe("content publish worker", () => {
  it("does not process a cancelled calendar item", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "instagram", status: "cancelled", content_id: "content-1" }] });
    await createContentPublishHandler()(job, { query } as never, { workerId: "test" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("marks content and calendar item failed without a provider", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "instagram", status: "scheduled", content_id: "content-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createContentPublishHandler()(job, { query } as never, { workerId: "test" })).rejects.toThrow("content_provider_not_configured:instagram");
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[2]?.[0]).toContain("status='failed'");
    expect(query.mock.calls[3]?.[0]).toContain("marketing_contents");
  });

  it("publishes Instagram content through the injected Meta adapter", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "media-1" }), { status: 200 }));
    const provider = createInstagramContentProvider({ accessToken: "secret", instagramUserId: "ig-1", fetchImpl });
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "instagram", content_type: "post", status: "scheduled", content_id: "content-1", body: "Post", media: ["https://cdn.example/post.jpg"] }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createContentPublishHandler(provider)(job, { query } as never, { workerId: "test" })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[2]?.[0]).toContain("status='published'");
  });

  it("does not create an Instagram provider when OAuth resolution is unavailable", async () => {
    await expect(createInstagramContentProviderFromResolver(async () => null)).resolves.toBeNull();
  });

  it("resolves the organization account through the encrypted-token function", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ instagram_business_account_id: "ig-1", access_token: "secret-in-memory" }] });
    const provider = await resolveInstagramContentProvider({ query } as never, "org-1");
    expect(provider?.id).toBe("meta_instagram_graph");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("fn_decrypt_oauth(access_token_encrypted)"), ["org-1", null]);
    expect(query.mock.calls[0]?.[0]).toContain("id::text=$2::text");
    expect(JSON.stringify(provider)).not.toContain("secret-in-memory");
  });

  it("passes the selected Instagram account to the provider resolver", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "instagram", content_type: "post", status: "scheduled", content_id: "content-1", body: "Post", media: [], instagram_account_id: "account-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const resolveProvider = vi.fn().mockResolvedValue({ id: "meta", enabled: false, publish: vi.fn() });

    await expect(createContentPublishHandler(undefined, resolveProvider)(job, { query } as never, { workerId: "test" })).rejects.toThrow("content_provider_not_configured:instagram");
    expect(resolveProvider).toHaveBeenCalledWith(job, expect.anything(), "account-1");
  });

  it("accepts structured media entries with an HTTPS URL", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "media-1" }), { status: 200 }));
    const provider = createInstagramContentProvider({ accessToken: "secret", instagramUserId: "ig-1", fetchImpl });
    await expect(provider.publish({ organizationId: "org-1", contentId: "content-1", channel: "instagram", body: "Legenda", media: [{ url: "https://cdn.example/post.jpg" }] })).resolves.toEqual({ externalId: "media-1" });
  });

  it("does not publish unsupported Instagram formats through the image adapter", async () => {
    const provider = createInstagramContentProvider({ accessToken: "secret", instagramUserId: "ig-1", fetchImpl: vi.fn() });
    await expect(provider.publish({ organizationId: "org-1", contentId: "content-1", channel: "instagram", contentType: "unsupported", body: "Roteiro", media: [{ url: "https://cdn.example/reel.mp4" }] })).rejects.toThrow("instagram_content_type_not_supported:unsupported");
  });
});
