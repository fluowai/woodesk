import { describe, expect, it, vi } from "vitest";

import { createGoogleBusinessSyncHandler } from "./google-business-worker";

const job = { organization_id: "org-1", payload: { location_id: "location-1" } } as never;

describe("Google Business sync worker", () => {
  it("requires a tenant-scoped location", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(createGoogleBusinessSyncHandler()(job, { query } as never, {} as never)).rejects.toThrow("google_business_location_not_found");
    expect(query.mock.calls[0]?.[0]).toContain("l.organization_id=$2");
    expect(query.mock.calls[0]?.[1]).toEqual(["location-1", "org-1"]);
  });

  it("fails closed when the encrypted OAuth token is absent", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ resource_name: "locations/123", connection_id: "connection-1", encrypted_token: null }] });

    await expect(createGoogleBusinessSyncHandler()(job, { query } as never, {} as never)).rejects.toThrow("google_business_oauth_missing");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
