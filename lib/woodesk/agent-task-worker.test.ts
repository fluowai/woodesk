import { describe, expect, it, vi } from "vitest";

import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";
import { createAgentTaskHandler } from "./agent-task-worker";

vi.mock("@/lib/agent-engine/edge/llm/run-model-call", () => ({
  runModelCall: vi.fn(),
}));

function job() {
  return { id: "job-1", organization_id: "org-1", payload: { task_id: "task-1" } } as never;
}

describe("agent task worker", () => {
  it("fails explicitly when human approval is required", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "lead_scoring", input: {}, requires_human_approval: true }] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createAgentTaskHandler()(job(), { query } as never)).rejects.toThrow("agent_task_approval_required");
    expect(query.mock.calls[1]?.[0]).toContain("agent_task_approval_required");
  });

  it("completes lead scoring from persisted evidence", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "lead_scoring", input: { result_id: "result-1" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: "Clínica Aurora", website: null, instagram: null, rating: 3.5, review_count: 8 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query).toHaveBeenCalledTimes(6);
    expect(query.mock.calls[3]?.[0]).toContain("score_band");
    expect(query.mock.calls[4]?.[0]).toContain("wodesk_usage_events");
    expect(query.mock.calls[5]?.[0]).toContain("status='completed'");
    expect(JSON.stringify(query.mock.calls[5]?.[1])).toContain("Clínica Aurora");
  });

  it("delegates lead enrichment to the specialized durable worker", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "lead_enrichment", input: { result_id: "result-1" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "result-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-enrichment-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query.mock.calls[3]?.[0]).toContain("lead_enrichment");
    expect(query.mock.calls[4]?.[0]).toContain("status='completed'");
  });

  it("creates and delegates a Lead Finder search", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "lead_search", input: { keyword: "clínicas", city: "São Paulo", limit: 10 }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ used: "0" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_id: "growth" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ enabled: true, monthly_limit: 100 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "search-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-search-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query.mock.calls[5]?.[0]).toContain("lead_finder_searches");
    expect(query.mock.calls[6]?.[0]).toContain("lead_finder_search");
    expect(query.mock.calls[7]?.[0]).toContain("wodesk_usage_events");
    expect(query.mock.calls[8]?.[0]).toContain("status='completed'");
  });

  it("delegates ready campaigns to the campaign worker", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "campaign_execution", input: { campaign_id: "campaign-1" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "campaign-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-campaign-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query.mock.calls[3]?.[0]).toContain("campaign_execution");
    expect(query.mock.calls[4]?.[0]).toContain("status='completed'");
  });

  it("delegates GeoGrid and Google Business work to their durable workers", async () => {
    const cases = [
      { capability: "local_geo_grid", input: { run_id: "run-1" }, resourceSql: "local_grid_runs", delegatedKind: "local_seo_grid" },
      { capability: "google_business_metrics", input: { location_id: "location-1" }, resourceSql: "google_business_locations", delegatedKind: "google_business_sync" },
    ];
    for (const item of cases) {
      const query = vi.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: item.capability, input: item.input, requires_human_approval: false }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "resource-1" }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-1" }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });
      await createAgentTaskHandler()(job(), { query } as never);
      expect(query.mock.calls[2]?.[0]).toContain(item.resourceSql);
      expect(query.mock.calls[3]?.[0]).toContain(item.delegatedKind);
    }
  });

  it("delegates a queued voice call without bypassing the voice worker", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "voice_conversation", input: { call_id: "call-1" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "call-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-voice-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query.mock.calls[3]?.[0]).toContain("voice_call");
    expect(query.mock.calls[4]?.[0]).toContain("status='completed'");
  });

  it("persists generated content as a draft requiring approval", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "content_generation", input: { channel: "instagram", content_type: "post", body: "Texto aprovado pelo agente", title: "Post local", audience: "Clientes", tone: "Direto", objective: "Gerar demanda" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ used: "0" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_id: "growth" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ enabled: true, monthly_limit: 100 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "content-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler()(job(), { query } as never);
    expect(query.mock.calls[5]?.[0]).toContain("marketing_contents");
    expect(query.mock.calls[5]?.[1]?.[1]).toBe("instagram");
    expect(query.mock.calls[6]?.[0]).toContain("wodesk_usage_events");
    expect(query.mock.calls[7]?.[1]?.[2]).toContain("requires_approval");
  });

  it("generates content through the official LLM seam when requested", async () => {
    vi.mocked(runModelCall).mockResolvedValueOnce({ result: { text: "Legenda gerada com contexto" } } as never);
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "content_generation", input: { channel: "instagram", content_type: "caption", generate: true, business_context: "Clínica local", audience: "Pacientes", tone: "Humano", objective: "Agendar avaliações" }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ used: "0" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_id: "growth" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ enabled: true, monthly_limit: 100 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "content-generated-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await createAgentTaskHandler({} as never)(job(), { query } as never);
    expect(runModelCall).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      tenantId: "org-1",
      purpose: "content_generation",
      messages: [expect.objectContaining({ role: "user", content: expect.stringContaining("Clínica local") })],
    }));
    expect(query.mock.calls[5]?.[1]?.[4]).toBe("Legenda gerada com contexto");
  });

  it("blocks content generation at the worker when the plan limit is reached", async () => {
    vi.mocked(runModelCall).mockClear();
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "content_generation", input: { channel: "instagram", content_type: "post", generate: true }, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ used: "10" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_id: "starter" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ enabled: true, monthly_limit: 10 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createAgentTaskHandler({} as never)(job(), { query } as never)).rejects.toThrow("agent_content_generation_plan_limit:limit_reached");
    expect(runModelCall).not.toHaveBeenCalled();
    expect(query.mock.calls[5]?.[0]).toContain("status='failed'");
  });

  it("marks unsupported capabilities as failed", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ capability: "unsupported_capability", input: {}, requires_human_approval: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(createAgentTaskHandler()(job(), { query } as never)).rejects.toThrow("agent_capability_executor_not_configured");
    expect(query.mock.calls[2]?.[1]?.[2]).toContain("agent_capability_executor_not_configured");
  });
});
