import type { WoodeskCapability } from "./capabilities";

export const WOODESK_AGENT_ROLES = [
  "lead_research",
  "qualification",
  "sales",
  "follow_up",
  "voice",
  "marketing",
  "content",
  "local_seo",
  "customer_success",
] as const;

export type WoodeskAgentRole = (typeof WOODESK_AGENT_ROLES)[number];

export interface AgentTaskRequest {
  organizationId: string;
  role: WoodeskAgentRole;
  capability: WoodeskCapability;
  input: Record<string, unknown>;
  requiresHumanApproval: boolean;
}

export interface AgentTaskPlan {
  role: WoodeskAgentRole;
  capability: WoodeskCapability;
  organizationId: string;
  queued: true;
  requiresHumanApproval: boolean;
}

const ROLE_CAPABILITIES: Record<WoodeskAgentRole, readonly WoodeskCapability[]> = {
  lead_research: ["lead_search", "lead_enrichment"],
  qualification: ["lead_scoring"],
  sales: ["campaign_execution"],
  follow_up: ["campaign_execution", "voice_conversation"],
  voice: ["voice_conversation"],
  marketing: ["campaign_execution", "content_generation"],
  content: ["content_generation"],
  local_seo: ["local_rank_tracking", "local_geo_grid", "competitor_analysis", "google_business_metrics"],
  customer_success: ["campaign_execution"],
};

export function planAgentTask(request: AgentTaskRequest): AgentTaskPlan {
  if (request.organizationId.trim() === "") throw new Error("agent_organization_required");
  if (!ROLE_CAPABILITIES[request.role].includes(request.capability)) throw new Error(`agent_capability_not_allowed:${request.role}:${request.capability}`);
  return { role: request.role, capability: request.capability, organizationId: request.organizationId, queued: true, requiresHumanApproval: request.requiresHumanApproval };
}
