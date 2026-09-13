import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createGrid } from "@/lib/woodesk/local-seo";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { recordUsageEvent } from "@/lib/woodesk/usage";

const inputSchema = z.object({
  keyword: z.string().trim().min(2).max(200),
  target_business_name: z.string().trim().min(2).max(200),
  locale: z.string().trim().min(2).max(20).default("pt-BR"),
  grid_size: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(9), z.literal(11)]).default(5),
  center_latitude: z.number().finite().min(-90).max(90),
  center_longitude: z.number().finite().min(-180).max(180),
});

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "local_seo").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Local SEO não está habilitado para esta organização.", 403, { requestId });
  const status = request.nextUrl.searchParams.get("status");
  let query = supabase.from("local_grid_runs").select("id, keyword_id, grid_size, center_latitude, center_longitude, status, provider_id, started_at, finished_at, error_code, created_at, local_keywords(keyword, locale)").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ runs: data ?? [] }, { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo" });
  if (!authz.ok) return authz.response;

  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Parâmetros do GeoGrid inválidos.", 422, { requestId });

  const supabase = await createClient();
  const db = supabase as SupabaseClient;
  const { data: flag, error: flagError } = await db.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "local_seo").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Esta capacidade não está habilitada para a organização.", 403, { requestId });
  const { data: organization, error: organizationError } = await db.from("organizations").select("plan_id").eq("id", authz.org.orgId).maybeSingle();
  if (organizationError) return fail("internal_error", organizationError.message, 500, { requestId });
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: runsThisMonth, error: usageError } = await db.from("local_grid_runs").select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).gte("created_at", monthStart.toISOString());
  if (usageError) return fail("internal_error", usageError.message, 500, { requestId });
  const { data: entitlement, error: entitlementError } = await db.from("plan_entitlements").select("enabled, monthly_limit").eq("plan_id", organization?.plan_id ?? "").eq("capability", "local_seo").maybeSingle();
  if (entitlementError) return fail("internal_error", entitlementError.message, 500, { requestId });
  const decision = decideEntitlement(entitlement ? { enabled: entitlement.enabled, monthlyLimit: entitlement.monthly_limit } : null, runsThisMonth ?? 0);
  if (!decision.allowed) return fail("plan_limit_reached", `Local SEO bloqueado pelo entitlement: ${decision.reason}.`, 403, { requestId });

  const keywordsTable: string = "local_keywords";
  const { data: keyword, error: keywordError } = await db.from(keywordsTable).upsert({
    organization_id: authz.org.orgId,
    keyword: parsed.data.keyword,
    target_business_name: parsed.data.target_business_name,
    locale: parsed.data.locale,
    active: true,
  }, { onConflict: "organization_id,keyword,locale" }).select("id, keyword, locale").single();
  if (keywordError || !keyword) return fail("internal_error", keywordError?.message ?? "Palavra-chave não criada.", 500, { requestId });

  const { data: run, error: runError } = await db.from("local_grid_runs").insert({
    organization_id: authz.org.orgId,
    keyword_id: keyword.id,
    grid_size: parsed.data.grid_size,
    center_latitude: parsed.data.center_latitude,
    center_longitude: parsed.data.center_longitude,
    status: "queued",
    provider_id: "browser_import",
  }).select("id, status, grid_size, created_at").single();
  if (runError || !run) return fail("internal_error", runError?.message ?? "Execução não criada.", 500, { requestId });

  const points = createGrid(parsed.data.grid_size, { latitude: parsed.data.center_latitude, longitude: parsed.data.center_longitude });
  const { error: pointsError } = await db.from("local_grid_points").insert(points.map((point) => ({
    organization_id: authz.org.orgId,
    run_id: run.id,
    row_index: point.row,
    column_index: point.column,
    latitude: point.latitude,
    longitude: point.longitude,
  })));
  if (pointsError) return fail("internal_error", pointsError.message, 500, { requestId });

  const { error: queueError } = await db.from("job_queue").insert({
    organization_id: authz.org.orgId,
    kind: "local_seo_grid",
    payload: { run_id: run.id },
    priority: 80,
  });
  if (queueError) return fail("internal_error", queueError.message, 500, { requestId });
  await recordUsageEvent(db, { organizationId: authz.org.orgId, capability: "local_seo", idempotencyKey: `local-seo:${run.id}`, metadata: { grid_size: parsed.data.grid_size } });
  return ok({ run, keyword, point_count: points.length }, { status: 202, requestId });
}
