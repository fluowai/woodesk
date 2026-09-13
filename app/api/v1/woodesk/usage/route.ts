import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { aggregateUsage, aggregateUsageHistory, usagePeriodStart } from "@/lib/woodesk/usage";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_usage" });
  if (!authz.ok) return authz.response;
  const db = await createClient();
  const usageTable: string = "woodesk_usage_events";
  const { data, error } = await db.from(usageTable)
    .select("capability, quantity, period_start")
    .eq("organization_id", authz.org.orgId)
    .eq("period_start", usagePeriodStart());
  if (error) return fail("internal_error", "Não foi possível carregar o consumo atual.", 500, { requestId });
  const usage = aggregateUsage(data ?? []);
  const historyStart = new Date();
  historyStart.setUTCDate(1);
  historyStart.setUTCMonth(historyStart.getUTCMonth() - 5);
  const { data: historyRows, error: historyError } = await db.from(usageTable)
    .select("capability, quantity, period_start")
    .eq("organization_id", authz.org.orgId)
    .gte("period_start", usagePeriodStart(historyStart));
  if (historyError) return fail("internal_error", "Não foi possível carregar o histórico de consumo.", 500, { requestId });
  return ok({ period_start: usagePeriodStart(), usage, history: aggregateUsageHistory(historyRows ?? []) }, { requestId });
}
