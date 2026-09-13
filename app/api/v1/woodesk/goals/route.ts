import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const metric = z.enum(["leads_found", "appointments", "opportunities", "sales_cents", "contents_generated", "voice_calls"]);
const inputSchema = z.object({ metric, target: z.number().positive(), period_start: z.string().date(), period_end: z.string().date(), label: z.string().trim().min(1).max(200) });
const idSchema = z.string().uuid();

async function currentForGoal(db: SupabaseClient, organizationId: string, goal: { metric: string; period_start: string; period_end: string }): Promise<number> {
  const start = `${goal.period_start}T00:00:00.000Z`;
  const endDate = new Date(`${goal.period_end}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString();
  const config: Record<string, { table: string; statuses?: string[] }> = {
    leads_found: { table: "lead_finder_results" },
    appointments: { table: "calendar_appointments", statuses: ["pending", "confirmed"] },
    opportunities: { table: "crm_leads", statuses: ["open"] },
    contents_generated: { table: "marketing_contents" },
    voice_calls: { table: "voice_calls", statuses: ["completed"] },
  };
  if (goal.metric === "sales_cents") {
    const result = await db.from("crm_leads").select("value_cents").eq("organization_id", organizationId).eq("status", "won").gte("closed_at", start).lt("closed_at", end);
    if (result.error) throw result.error;
    return (result.data ?? []).reduce((total, row) => total + (typeof row.value_cents === "number" ? Math.max(0, row.value_cents) : 0), 0);
  }
  const selected = config[goal.metric];
  if (!selected) return 0;
  let query = db.from(selected.table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", start).lt("created_at", end);
  if (selected.statuses) query = query.in("status", selected.statuses);
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_goals" });
  if (!authz.ok) return authz.response;
  const db = (await createClient()) as unknown as SupabaseClient;
  const goalsTable: string = "woodesk_goals";
  const { data, error } = await db.from(goalsTable).select("id, metric, target, period_start, period_end, label, created_at, updated_at").eq("organization_id", authz.org.orgId).order("period_start", { ascending: false }).limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  try {
    const goals = await Promise.all((data ?? []).map(async (goal) => ({ ...goal, current: await currentForGoal(db, authz.org.orgId, goal as { metric: string; period_start: string; period_end: string }) })));
    const notificationsTable: string = "woodesk_notifications";
    await Promise.all(goals.filter((goal) => Number(goal.current) >= Number(goal.target)).map(async (goal) => {
      await db.from(notificationsTable).insert({
        organization_id: authz.org.orgId,
        kind: "goal_reached",
        title: "Meta atingida",
        body: `A meta “${goal.label}” atingiu o alvo definido.`,
        metadata: { goal_id: goal.id, metric: goal.metric, current: goal.current, target: goal.target },
        idempotency_key: `goal:${goal.id}:${goal.period_end}`,
      });
    }));
    return ok({ goals }, { requestId });
  } catch (goalError) {
    return fail("internal_error", goalError instanceof Error ? goalError.message : "Não foi possível calcular as metas.", 500, { requestId });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_goals" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success || parsed.data.period_end < parsed.data.period_start) return fail("validation_failed", "Meta ou período inválido.", 422, { requestId });
  const db = (await createClient()) as unknown as SupabaseClient;
  const goalsTable: string = "woodesk_goals";
  const { data, error } = await db.from(goalsTable).insert({ organization_id: authz.org.orgId, metric: parsed.data.metric, target: parsed.data.target, period_start: parsed.data.period_start, period_end: parsed.data.period_end, label: parsed.data.label, created_by: authz.user.id }).select("id, metric, target, period_start, period_end, label, created_at").single();
  if (error || !data) return fail("internal_error", error?.message ?? "Meta não criada.", 500, { requestId });
  return ok(data, { status: 201, requestId });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_goals" });
  if (!authz.ok) return authz.response;
  const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return fail("validation_failed", "Identificador da meta inválido.", 422, { requestId });
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success || parsed.data.period_end < parsed.data.period_start) return fail("validation_failed", "Meta ou período inválido.", 422, { requestId });
  const db = await createClient();
  const goalsTable: string = "woodesk_goals";
  const { data, error } = await db.from(goalsTable).update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id.data).eq("organization_id", authz.org.orgId).select("id, metric, target, period_start, period_end, label, created_at, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Meta não encontrada.", 404, { requestId });
  return ok(data, { requestId });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_goals" });
  if (!authz.ok) return authz.response;
  const id = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return fail("validation_failed", "Identificador da meta inválido.", 422, { requestId });
  const db = await createClient();
  const goalsTable: string = "woodesk_goals";
  const { error, count } = await db.from(goalsTable).delete({ count: "exact" }).eq("id", id.data).eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (count !== 1) return fail("not_found", "Meta não encontrada.", 404, { requestId });
  return ok({ deleted: true }, { requestId });
}
