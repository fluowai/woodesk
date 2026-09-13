import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { aggregateGridMetrics } from "@/lib/woodesk/local-seo";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = (await createClient()) as SupabaseClient;
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "local_seo").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Local SEO não está habilitado para esta organização.", 403, { requestId });
  const { data: run, error: runError } = await supabase
    .from("local_grid_runs")
    .select("id, keyword_id, grid_size, center_latitude, center_longitude, status, provider_id, started_at, finished_at, error_code, created_at, local_keywords(keyword, locale)")
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (runError) return fail("internal_error", runError.message, 500, { requestId });
  if (!run) return fail("not_found", "Execução de GeoGrid não encontrada.", 404, { requestId });

  const { data: points, error: pointsError } = await supabase
    .from("local_grid_points")
    .select("id, row_index, column_index, latitude, longitude, position, top_result_name, top_result_url")
    .eq("organization_id", authz.org.orgId)
    .eq("run_id", id)
    .order("row_index", { ascending: true })
    .order("column_index", { ascending: true });
  if (pointsError) return fail("internal_error", pointsError.message, 500, { requestId });
  return ok({ run, points: points ?? [], metrics: aggregateGridMetrics(points ?? []) }, { requestId });
}
