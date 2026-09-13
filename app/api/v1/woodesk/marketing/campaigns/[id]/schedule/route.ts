import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/agent-engine/queue/queue";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { recordUsageEvent } from "@/lib/woodesk/usage";

const inputSchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_campaign_schedule" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Janela de campanha inválida.", 422, { requestId });
  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = parsed.data.ends_at ? new Date(parsed.data.ends_at) : null;
  if (startsAt <= new Date() || (endsAt && endsAt < startsAt)) return fail("validation_failed", "A janela de campanha é inválida.", 422, { requestId });

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "marketing_calendar").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Campanhas não estão habilitadas para esta organização.", 403, { requestId });
  const { data: organization, error: organizationError } = await supabase.from("organizations").select("plan_id").eq("id", authz.org.orgId).maybeSingle();
  if (organizationError) return fail("internal_error", organizationError.message, 500, { requestId });
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: campaignsThisMonth, error: usageError } = await supabase.from("marketing_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).gte("created_at", monthStart.toISOString());
  if (usageError) return fail("internal_error", usageError.message, 500, { requestId });
  const { data: entitlement, error: entitlementError } = await supabase.from("plan_entitlements").select("enabled, monthly_limit").eq("plan_id", organization?.plan_id ?? "").eq("capability", "campaign_execution").maybeSingle();
  if (entitlementError) return fail("internal_error", entitlementError.message, 500, { requestId });
  const decision = decideEntitlement(entitlement ? { enabled: entitlement.enabled, monthlyLimit: entitlement.monthly_limit } : null, campaignsThisMonth ?? 0);
  if (!decision.allowed) return fail("plan_limit_reached", `Campanhas bloqueadas pelo entitlement: ${decision.reason}.`, 403, { requestId });
  const { data, error } = await supabase.from("marketing_campaigns").update({
    status: "scheduled",
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "approved")
    .select("id, name, status, starts_at, ends_at, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("invalid_state", "A campanha precisa estar aprovada para ser agendada.", 409, { requestId });
  try {
    const { job, deduped } = await enqueueJob(getRequestPool(), authz.org.orgId, {
      kind: "campaign_execution",
      payload: { campaign_id: data.id },
      runAfter: startsAt,
      maxAttempts: 3,
    });
    await recordUsageEvent(supabase, { organizationId: authz.org.orgId, capability: "campaign_execution", idempotencyKey: `campaign:${data.id}`, metadata: { starts_at: data.starts_at } });
    return ok({ ...data, job_id: job.id, deduped }, { requestId });
  } catch {
    await supabase.from("marketing_campaigns").update({ status: "approved", starts_at: null, ends_at: null, updated_at: new Date().toISOString() }).eq("id", data.id).eq("organization_id", authz.org.orgId).eq("status", "scheduled");
    return fail("service_unavailable", "Não foi possível agendar a execução da campanha.", 503, { requestId });
  }
}
