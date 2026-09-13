import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_google_business_metrics" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "google_business").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Google Business não está habilitado para esta organização.", 403, { requestId });
  const locationId = request.nextUrl.searchParams.get("location_id");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  let query = supabase.from("google_business_metrics")
    .select("id, location_id, period_start, period_end, metrics, source, fetched_at, google_business_locations(id, title, resource_name)")
    .eq("organization_id", authz.org.orgId)
    .order("period_start", { ascending: false });
  if (locationId) query = query.eq("location_id", locationId);
  if (from) query = query.gte("period_start", from);
  if (to) query = query.lte("period_end", to);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ metrics: data ?? [] }, { requestId });
}
