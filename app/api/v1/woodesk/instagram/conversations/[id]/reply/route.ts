import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { enqueueJob } from "@/lib/agent-engine/queue/queue";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { usagePeriodStart } from "@/lib/woodesk/usage";

const bodySchema = z.object({ text: z.string().trim().min(1).max(1000) });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_instagram_reply" });
  if (!authz.ok) return authz.response;
  const { id: conversationId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "A mensagem Instagram é inválida.", 422, { requestId });

  const db = await createClient();
  const { data: flag, error: flagError } = await db.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "instagram_studio").maybeSingle();
  if (flagError) return fail("internal_error", "Não foi possível consultar a disponibilidade do Instagram.", 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Instagram não está habilitado para esta organização.", 403, { requestId });
  const monthStart = usagePeriodStart();
  const [{ count: messagesThisMonth, error: usageError }, { data: organization, error: organizationError }] = await Promise.all([
    db.from("woodesk_usage_events" as string).select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).eq("capability", "instagram_messaging").eq("period_start", monthStart),
    db.from("organizations").select("plan_id").eq("id", authz.org.orgId).maybeSingle(),
  ]);
  if (usageError || organizationError) return fail("internal_error", "Não foi possível consultar o limite do Instagram.", 500, { requestId });
  const { data: entitlement, error: entitlementError } = await db.from("plan_entitlements").select("enabled, monthly_limit").eq("plan_id", organization?.plan_id ?? "").eq("capability", "instagram_messaging").maybeSingle();
  if (entitlementError) return fail("internal_error", "Não foi possível consultar o entitlement do Instagram.", 500, { requestId });
  const decision = decideEntitlement(entitlement ? { enabled: entitlement.enabled, monthlyLimit: entitlement.monthly_limit } : null, messagesThisMonth ?? 0);
  if (!decision.allowed) return fail("plan_limit_reached", `Mensagens Instagram bloqueadas pelo entitlement: ${decision.reason}.`, 403, { requestId });

  try {
    const { job, deduped } = await enqueueJob(getRequestPool(), authz.org.orgId, { kind: "instagram_reply", payload: { conversation_id: conversationId, text: parsed.data.text }, maxAttempts: 3 });
    return ok({ job_id: job.id, status: "queued", deduped }, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível enfileirar a resposta Instagram.", 503, { requestId });
  }
}
