import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/agent-engine/queue/queue";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { planAgentTask, type WoodeskAgentRole } from "@/lib/woodesk/orchestrator";
import type { WoodeskCapability } from "@/lib/woodesk/capabilities";

const inputSchema = z.object({
  role: z.enum(["lead_research", "qualification", "sales", "follow_up", "voice", "marketing", "content", "local_seo", "customer_success"]),
  capability: z.enum(["lead_search", "lead_enrichment", "lead_scoring", "google_business_metrics", "local_rank_tracking", "local_geo_grid", "competitor_analysis", "content_generation", "campaign_execution", "voice_conversation", "instagram_messaging"]),
  input: z.record(z.string(), z.unknown()).default({}),
  requires_human_approval: z.boolean().default(true),
});

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_agent_orchestrator" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Tarefa de agente inválida.", 422, { requestId });
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "agent_orchestrator").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Orquestração de agentes não está habilitada para esta organização.", 403, { requestId });
  try {
    const plan = planAgentTask({ organizationId: authz.org.orgId, role: parsed.data.role as WoodeskAgentRole, capability: parsed.data.capability as WoodeskCapability, input: parsed.data.input, requiresHumanApproval: parsed.data.requires_human_approval });
    const taskTable: string = "agent_tasks";
    const { data: task, error: taskError } = await supabase.from(taskTable).insert({ organization_id: authz.org.orgId, requested_by: authz.user.id, role: plan.role, capability: plan.capability, input: parsed.data.input, status: "queued", requires_human_approval: plan.requiresHumanApproval }).select("id, role, capability, status, requires_human_approval, created_at").single();
    if (taskError || !task) return fail("internal_error", taskError?.message ?? "Tarefa não persistida.", 500, { requestId });
    const { job, deduped } = await enqueueJob(getRequestPool(), authz.org.orgId, { kind: "agent_task", payload: { task_id: task.id }, maxAttempts: 3 });
    return ok({ plan, task, job_id: job.id, deduped, execution: "queued" }, { status: 202, requestId });
  } catch (error) {
    return fail("validation_failed", error instanceof Error ? error.message : "Tarefa não permitida.", 422, { requestId });
  }
}
