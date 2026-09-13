import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { aggregateAiCosts, type AiCostRow } from "@/lib/woodesk/ai-cost";

const MAX_DAYS = 366;

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_ai_costs" });
  if (!authz.ok) return authz.response;
  const db = await createClient();
  const { data: flag, error: flagError } = await db.from("feature_flags" as string).select("enabled").eq("organization_id", authz.org.orgId).eq("key", "analytics").maybeSingle();
  if (flagError) return fail("internal_error", "Não foi possível consultar a disponibilidade do Analytics.", 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Analytics não está habilitado para esta organização.", 403, { requestId });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    return fail("validation_failed", "O período de custo é inválido ou excede 366 dias.", 422, { requestId });
  }
  const { data, error } = await db.from("llm_calls" as string)
    .select("agent_id, provider, input_tokens, output_tokens, cost_cents, created_at")
    .eq("organization_id", authz.org.orgId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", "Não foi possível carregar os custos de IA.", 500, { requestId });
  return ok({ window: { from: from.toISOString(), to: to.toISOString() }, ...aggregateAiCosts((data ?? []) as AiCostRow[]) }, { requestId });
}
