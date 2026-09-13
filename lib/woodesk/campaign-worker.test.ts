import { describe, expect, it, vi } from "vitest";

import { createCampaignExecutionHandler, createHttpCampaignDeliveryProvider } from "./campaign-worker";

function job(payload: Record<string, unknown>) {
  return { organization_id: "org-1", payload } as never;
}

describe("campaign execution worker", () => {
  it("rejects jobs without a campaign id", async () => {
    const handler = createCampaignExecutionHandler();
    await expect(handler(job({}), { query: vi.fn() } as never, { workerId: "test" })).rejects.toThrow("campaign_id_missing");
  });

  it("marks an unconfigured channel as failed without sending", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "whatsapp", status: "scheduled" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const handler = createCampaignExecutionHandler();
    await expect(handler(job({ campaign_id: "campaign-1" }), { query } as never, { workerId: "test" })).rejects.toThrow("campaign_provider_not_configured:whatsapp");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("status='failed'");
  });

  it("supports an injected HTTP delivery provider", async () => {
    const requests: Request[] = [];
    const provider = createHttpCampaignDeliveryProvider({
      id: "marketing-sidecar",
      baseUrl: "https://marketing.example.test/",
      bearerToken: "secret",
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify({ externalId: "delivery-1" }), { status: 200 });
      },
    });
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "email", status: "scheduled", audience_filter: { city: "SP" }, settings: { template: "welcome" } }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createCampaignExecutionHandler(provider)(job({ campaign_id: "campaign-1" }), { query } as never, { workerId: "test" })).resolves.toBeUndefined();
    expect(requests[0]?.url).toBe("https://marketing.example.test/campaigns/deliver");
    expect(query.mock.calls[2]?.[0]).toContain("status='completed'");
  });

  it("marks a configured campaign failed when delivery errors", async () => {
    const provider = { id: "sidecar", enabled: true, healthCheck: vi.fn(), deliver: vi.fn().mockRejectedValue(new Error("provider_timeout")) };
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ channel: "email", status: "scheduled", audience_filter: {}, settings: {} }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createCampaignExecutionHandler(provider)(job({ campaign_id: "campaign-1" }), { query } as never, { workerId: "test" })).rejects.toThrow("campaign_delivery_failed:provider_timeout");
    expect(query.mock.calls[2]?.[0]).toContain("status='failed'");
  });
});
