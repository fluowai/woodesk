import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_results" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  const searchId = request.nextUrl.searchParams.get("search_id");
  const status = request.nextUrl.searchParams.get("status");
  let query = supabase.from("lead_finder_results").select("id, search_id, name, category, phone, website, instagram, address, city, state, rating, review_count, source_url, latitude, longitude, normalized_phone, has_whatsapp, status, imported_lead_id, lead_enrichment(status, email, facebook, domain, website_analysis, score, score_band, score_reasons, error_code, processed_at)").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (searchId) query = query.eq("search_id", searchId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ results: data ?? [] }, { requestId });
}
