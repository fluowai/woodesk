import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { aggregateUsageAnalytics } from "@/lib/woodesk/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_analytics" });
  if (!authz.ok) return authz.response;
  const db = await createClient();
  const flagsTable: string = "feature_flags";
  const usageTable: string = "woodesk_usage_events";
  const { data: flag, error: flagError } = await db.from(flagsTable).select("enabled").eq("organization_id", authz.org.orgId).eq("key", "analytics").maybeSingle();
  if (flagError) return fail("internal_error", "Não foi possível consultar a disponibilidade do Analytics.", 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Analytics não está habilitado para esta organização.", 403, { requestId });

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : new Date(to.getTime() - 30 * DAY_MS);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) {
    return fail("validation_failed", "O período analítico é inválido ou excede 366 dias.", 422, { requestId });
  }

  const { data, error } = await db.from(usageTable)
    .select("capability, quantity, period_start, created_at")
    .eq("organization_id", authz.org.orgId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", "Não foi possível carregar os dados analíticos.", 500, { requestId });

  const aggregate = aggregateUsageAnalytics(data ?? []);
  return ok({ window: { from: from.toISOString(), to: to.toISOString() }, total: aggregate.total, by_capability: aggregate.byCapability, by_day: aggregate.byDay }, { requestId });
}
