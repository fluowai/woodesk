import { describe, expect, it } from "vitest";
import { planAgentTask } from "./orchestrator";

describe("Woodesk agent orchestrator", () => {
  it("plans an allowed task without executing a provider", () => {
    expect(planAgentTask({ organizationId: "org-1", role: "local_seo", capability: "local_geo_grid", input: {}, requiresHumanApproval: false })).toMatchObject({ organizationId: "org-1", queued: true });
  });

  it("rejects capability outside the role contract", () => {
    expect(() => planAgentTask({ organizationId: "org-1", role: "content", capability: "voice_conversation", input: {}, requiresHumanApproval: true })).toThrow("agent_capability_not_allowed");
  });

  it("keeps customer success restricted to the currently defined campaign capability", () => {
    expect(planAgentTask({ organizationId: "org-1", role: "customer_success", capability: "campaign_execution", input: {}, requiresHumanApproval: true })).toMatchObject({ role: "customer_success", capability: "campaign_execution", requiresHumanApproval: true });
    expect(() => planAgentTask({ organizationId: "org-1", role: "customer_success", capability: "content_generation", input: {}, requiresHumanApproval: true })).toThrow("agent_capability_not_allowed");
  });
});
