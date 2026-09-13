import { describe, expect, it, vi } from "vitest";

import { createLocalSeoGridHandler } from "./local-seo-worker";

describe("local SEO grid worker", () => {
  it("exposes the durable queue handler contract", () => {
    expect(typeof createLocalSeoGridHandler({
      id: "test",
      capabilities: ["local_seo"],
      priority: 1,
      enabled: false,
      healthCheck: vi.fn(),
      search: vi.fn(),
    } as never)).toBe("function");
  });

  it("rejects a job without a run id before opening a database connection", async () => {
    const pool = { connect: vi.fn() };
    const handler = createLocalSeoGridHandler({ enabled: false } as never);
    await expect(handler({ payload: {}, organization_id: "org-1" } as never, pool as never)).rejects.toThrow("local_seo_run_id_missing");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("does not issue a rollback after the setup transaction has already committed", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("from local_grid_runs")) return { rows: [{ organization_id: "org-1", keyword_id: "keyword-1", keyword: "dentista", target_business_name: "Clínica Aurora" }] };
        if (sql.includes("from local_grid_points")) return { rows: [{ id: "point-1", latitude: 1, longitude: 2 }] };
        if (sql === "commit") return { rows: [] };
        if (sql.includes("update local_grid_runs set status = 'completed'")) throw new Error("provider_write_failed");
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client), query: vi.fn() };
    const provider = { enabled: true, search: vi.fn().mockRejectedValue(new Error("provider_unavailable")) };
    const handler = createLocalSeoGridHandler(provider as never);

    await expect(handler({ payload: { run_id: "run-1" }, organization_id: "org-1" } as never, pool as never)).rejects.toThrow("provider_unavailable");
    expect(queries).toContain("commit");
    expect(queries).not.toContain("rollback");
    expect(pool.query).toHaveBeenCalled();
  });

  it("does not invent a ranking position from a Places result", async () => {
    const pointUpdateParams: unknown[] = [];
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("from local_grid_runs")) return { rows: [{ organization_id: "org-1", keyword_id: "keyword-1", keyword: "dentista", target_business_name: "Clínica Aurora" }] };
        if (sql.includes("from local_grid_points")) return { rows: [{ id: "point-1", latitude: 1, longitude: 2 }] };
        if (sql.includes("update local_grid_points")) { pointUpdateParams.push(params); return { rows: [] }; }
        if (sql === "commit") return { rows: [] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client), query: vi.fn() };
    const provider = { enabled: true, search: vi.fn().mockResolvedValue([{ name: "Clínica Aurora", sourceUrl: "https://maps.google.com/a", rating: 4.8, reviewCount: 40 }]) };
    await createLocalSeoGridHandler(provider as never)({ payload: { run_id: "run-1" }, organization_id: "org-1" } as never, pool as never);
    expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect((pointUpdateParams[0] as unknown[])[2]).toBeNull();
  });

  it("requires an explicit target business before querying Places", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("from local_grid_runs")) return { rows: [{ organization_id: "org-1", keyword_id: "keyword-1", keyword: "dentista", target_business_name: null }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client), query: vi.fn() };
    const provider = { enabled: true, search: vi.fn() };
    await expect(createLocalSeoGridHandler(provider as never)({ payload: { run_id: "run-1" }, organization_id: "org-1" } as never, pool as never)).rejects.toThrow("local_seo_target_business_not_configured");
    expect(provider.search).not.toHaveBeenCalled();
  });
});
