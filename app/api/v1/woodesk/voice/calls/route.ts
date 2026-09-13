import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { canStartVoiceOutbound, type VoiceCallDirection } from "@/lib/woodesk/voice";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { recordUsageEvent } from "@/lib/woodesk/usage";

const inputSchema = z.object({
  contact_id: z.string().uuid().optional(),
  direction: z.enum(["inbound", "outbound"]),
  provider_id: z.string().trim().min(1).max(80),
  metadata: z.record(z.string(), z.unknown()).optional(),
  consented: z.boolean().default(false),
  opted_out: z.boolean().default(false),
  within_allowed_hours: z.boolean().default(false),
});

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_voice" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Solicitação de ligação inválida.", 422, { requestId });
  const supabase = (await createClient()) as SupabaseClient;
  const voiceCallsTable: string = "voice_calls";
  const organizationsTable: string = "organizations";
  const entitlementsTable: string = "plan_entitlements";
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "voice_ai").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Voz não está habilitada para esta organização.", 403, { requestId });
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const { count: callsThisMonth, error: countError } = await supabase.from(voiceCallsTable).select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).eq("direction", "outbound").gte("created_at", startOfMonth.toISOString());
  if (countError) return fail("internal_error", countError.message, 500, { requestId });
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: callsToday, error: dailyCountError } = await supabase.from(voiceCallsTable).select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).eq("direction", "outbound").gte("created_at", startOfDay.toISOString());
  if (dailyCountError) return fail("internal_error", dailyCountError.message, 500, { requestId });
  const direction: VoiceCallDirection = parsed.data.direction;
  if (direction === "outbound") {
    const { data: organization, error: organizationError } = await supabase.from(organizationsTable).select("plan_id").eq("id", authz.org.orgId).maybeSingle();
    if (organizationError) return fail("internal_error", organizationError.message, 500, { requestId });
    const planId = (organization as { plan_id?: string | null } | null)?.plan_id;
    const { data: entitlement, error: entitlementError } = await supabase.from(entitlementsTable).select("enabled, monthly_limit").eq("plan_id", planId ?? "").eq("capability", "voice_ai").maybeSingle();
    if (entitlementError) return fail("internal_error", entitlementError.message, 500, { requestId });
    const decision = decideEntitlement(entitlement ? { enabled: entitlement.enabled, monthlyLimit: entitlement.monthly_limit } : null, callsThisMonth ?? 0);
    if (!decision.allowed) return fail("plan_limit_reached", `Voz bloqueada pelo entitlement: ${decision.reason}.`, 403, { requestId });
    const guard = canStartVoiceOutbound({ consented: parsed.data.consented, optedOut: parsed.data.opted_out, withinAllowedHours: parsed.data.within_allowed_hours, callsToday: callsToday ?? 0, dailyLimit: 20 });
    if (!guard.allowed) return fail("policy_blocked", `Ligação bloqueada: ${guard.reason}.`, 403, { requestId });
  }
  const { data: call, error } = await supabase.from(voiceCallsTable).insert({ organization_id: authz.org.orgId, contact_id: parsed.data.contact_id ?? null, provider_id: parsed.data.provider_id, direction, status: "queued", metadata: parsed.data.metadata ?? {} }).select("id, provider_id, direction, status, created_at").single();
  if (error || !call) return fail("internal_error", error?.message ?? "Ligação não criada.", 500, { requestId });
  const { error: queueError } = await supabase.from("job_queue").insert({ organization_id: authz.org.orgId, kind: "voice_call", payload: { call_id: call.id }, priority: 70 });
  if (queueError) return fail("internal_error", queueError.message, 500, { requestId });
  await recordUsageEvent(supabase, { organizationId: authz.org.orgId, capability: "voice_ai", idempotencyKey: `voice-call:${call.id}`, metadata: { direction } });
  return ok(call, { status: 202, requestId });
}
