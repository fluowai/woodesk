import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { buildWoodeskDashboardMetrics } from "@/lib/woodesk/dashboard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

type Row = Record<string, unknown>;

async function countRows(
  db: SupabaseClient,
  table: string,
  organizationId: string,
  from: string,
  to: string,
  status?: readonly string[],
): Promise<number> {
  let query = db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", from)
    .lt("created_at", to);
  if (status) query = query.in("status", status);
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function sumWonLeads(
  db: SupabaseClient,
  organizationId: string,
  from: string,
  to: string,
): Promise<number> {
  const result = await db
    .from("crm_leads")
    .select("value_cents")
    .eq("organization_id", organizationId)
    .eq("status", "won")
    .gte("closed_at", from)
    .lt("closed_at", to);
  if (result.error) throw result.error;
  return (result.data as Row[] | null ?? []).reduce(
    (total, row) => total + (typeof row.value_cents === "number" ? Math.max(0, row.value_cents) : 0),
    0,
  );
}

async function readPeriod(
  db: SupabaseClient,
  organizationId: string,
  from: Date,
  to: Date,
) {
  const start = from.toISOString();
  const end = to.toISOString();
  const [leadsFound, meetingsScheduled, opportunities, contentsGenerated, voiceCalls, salesCents] = await Promise.all([
    countRows(db, "lead_finder_results", organizationId, start, end),
    countRows(db, "calendar_appointments", organizationId, start, end, ["pending", "confirmed"]),
    countRows(db, "crm_leads", organizationId, start, end, ["open"]),
    countRows(db, "marketing_contents", organizationId, start, end),
    countRows(db, "voice_calls", organizationId, start, end, ["completed"]),
    sumWonLeads(db, organizationId, start, end),
  ]);
  return { leadsFound, meetingsScheduled, opportunities, contentsGenerated, voiceCalls, salesCents };
}

async function readTrend(
  db: SupabaseClient,
  organizationId: string,
  from: Date,
  to: Date,
) {
  const days: Date[] = [];
  for (let cursor = new Date(from); cursor < to; cursor = new Date(cursor.getTime() + DAY_MS)) days.push(cursor);
  return Promise.all(days.map(async (cursor) => {
    const next = new Date(Math.min(cursor.getTime() + DAY_MS, to.getTime()));
    const values = await readPeriod(db, organizationId, cursor, next);
    return { date: cursor.toISOString().slice(0, 10), ...values };
  }));
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_dashboard" });
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const end = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : new Date();
  const start = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from") as string)
    : new Date(end.getTime() - 30 * DAY_MS);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > MAX_DAYS * DAY_MS) {
    return fail("validation_failed", "Janela de dashboard inválida ou superior a 366 dias.", 422, { requestId });
  }

  const duration = end.getTime() - start.getTime();
  const previousEnd = start;
  const previousStart = new Date(start.getTime() - duration);
  try {
    const db = (await createClient()) as unknown as SupabaseClient;
    const [current, previous, trend] = await Promise.all([
      readPeriod(db, authz.org.orgId, start, end),
      readPeriod(db, authz.org.orgId, previousStart, previousEnd),
      readTrend(db, authz.org.orgId, start, end),
    ]);
    const recentActivityResult = await db
      .from("crm_lead_activities")
      .select("id, lead_id, contact_id, type, reason, source_module, performed_at, actor_kind, payload")
      .eq("organization_id", authz.org.orgId)
      .order("performed_at", { ascending: false })
      .limit(10);
    if (recentActivityResult.error) throw recentActivityResult.error;
    const failedJobsResult = await db
      .from("job_queue")
      .select("id, kind, last_error, created_at, attempts", { count: "exact" })
      .eq("organization_id", authz.org.orgId)
      .in("status", ["failed", "dead"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (failedJobsResult.error) throw failedJobsResult.error;
    const notificationsTable: string = "woodesk_notifications";
    await Promise.all((failedJobsResult.data ?? []).map(async (job) => {
      await db.from(notificationsTable).insert({
        organization_id: authz.org.orgId,
        kind: "job_failed",
        title: "Job com falha",
        body: `A execução ${job.kind} falhou e precisa de atenção.`,
        metadata: { job_id: job.id, attempts: job.attempts },
        idempotency_key: `job-failed:${job.id}`,
      });
    }));
    return ok({
      window: { from: start.toISOString(), to: end.toISOString() },
      metrics: buildWoodeskDashboardMetrics({ ...current, previous }),
      trend,
      recent_activity: recentActivityResult.data ?? [],
      alerts: { failed_jobs: failedJobsResult.count ?? 0, recent: failedJobsResult.data ?? [] },
    }, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível carregar as métricas do dashboard.", 500, { requestId });
  }
}
