import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { generateLeadDiagnostic, type LeadDiagnostic } from "@/lib/woodesk/diagnostic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_diagnostic" });
  if (!authz.ok) return authz.response;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("organization_id", authz.org.orgId)
    .eq("key", "lead_finder")
    .maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });

  const { data: result, error } = await supabase
    .from("lead_finder_results")
    .select("id, name, website, instagram, rating, review_count, lead_enrichment(website_analysis)")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!result) return fail("not_found", "Resultado não encontrado.", 404, { requestId });

  const enrichment = Array.isArray(result.lead_enrichment) ? result.lead_enrichment[0] : result.lead_enrichment;
  const analysis = enrichment?.website_analysis;
  const hasWebsite = Boolean(result.website);
  const websiteQuality = analysis && typeof analysis === "object" && "emails_found" in analysis && Number(analysis.emails_found) > 0 ? "good" : undefined;
  let diagnostic: LeadDiagnostic;
  try {
    diagnostic = generateLeadDiagnostic(result.name, {
      hasWebsite,
      websiteQuality,
      rating: result.rating ?? undefined,
      reviewCount: result.review_count ?? undefined,
      instagramQuality: result.instagram ? undefined : "poor",
    });
  } catch {
    return fail("internal_error", "Não foi possível gerar o diagnóstico.", 500, { requestId });
  }

  return ok({ result_id: result.id, diagnostic, evidence: { has_website: hasWebsite, website_analyzed: Boolean(analysis), has_instagram: Boolean(result.instagram) } }, { requestId });
}
