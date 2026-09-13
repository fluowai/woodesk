import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo_competitors" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "local_seo").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Local SEO não está habilitado para esta organização.", 403, { requestId });
  const { data: keyword, error: keywordError } = await supabase.from("local_keywords").select("id, keyword, locale").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (keywordError) return fail("internal_error", keywordError.message, 500, { requestId });
  if (!keyword) return fail("not_found", "Palavra-chave não encontrada.", 404, { requestId });
  const { data, error } = await supabase.from("local_competitors").select("id, business_name, position, rating, review_count, distance_meters, website, phone, source_url, observed_at").eq("organization_id", authz.org.orgId).eq("keyword_id", id).order("observed_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ keyword, competitors: data ?? [] }, { requestId });
}
