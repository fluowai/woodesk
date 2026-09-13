import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";

const inputSchema = z.object({
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_import" });
  if (!authz.ok) return authz.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("validation_failed", "Resultado inválido.", 422, { requestId });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", "JSON inválido.", 400, { requestId });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Pipeline e etapa são obrigatórios.", 422, { requestId });

  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  const { data: result, error: resultError } = await supabase
    .from("lead_finder_results")
    .select("id, name, category, phone, website, address, city, state, source_url, external_id, status, imported_lead_id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (resultError) return fail("internal_error", resultError.message, 500, { requestId });
  if (!result) return fail("not_found", "Resultado não encontrado.", 404, { requestId });
  if (result.imported_lead_id) return ok({ lead_id: result.imported_lead_id, already_imported: true }, { requestId });

  try {
    const lead = await createLeadHandler(
      supabase,
      {
        organization_id: authz.org.orgId,
        actor: { type: "user", id: authz.user.id },
        requestId,
        idioma: authz.user.idioma,
      },
      {
        pipeline_id: parsed.data.pipeline_id,
        stage_id: parsed.data.stage_id,
        title: result.name,
        description: [result.address, result.city, result.state].filter(Boolean).join(", ") || null,
        contact_id: null,
        currency: "BRL",
        tags: result.category ? [result.category] : [],
        source: "browser_import",
        external_id: `woodesk-lead-finder:${result.id}`,
        custom_fields: {
          lead_finder_result_id: result.id,
          phone: result.phone,
          website: result.website,
          source_url: result.source_url,
          external_id: result.external_id,
        },
      },
    );
    const leadId = typeof lead.id === "string" ? lead.id : null;
    if (!leadId) return fail("internal_error", "Lead criado sem identificador.", 500, { requestId });
    const { error: updateError } = await supabase
      .from("lead_finder_results")
      .update({ imported_lead_id: leadId, status: "imported" })
      .eq("id", result.id)
      .eq("organization_id", authz.org.orgId)
      .is("imported_lead_id", null);
    if (updateError) return fail("internal_error", updateError.message, 500, { requestId });
    return ok({ lead_id: leadId, result_id: result.id, already_imported: false }, { status: 201, requestId });
  } catch {
    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("organization_id", authz.org.orgId)
      .eq("external_id", `woodesk-lead-finder:${result.id}`)
      .maybeSingle();
    if (existingLead?.id) {
      await supabase
        .from("lead_finder_results")
        .update({ imported_lead_id: existingLead.id, status: "imported" })
        .eq("id", result.id)
        .eq("organization_id", authz.org.orgId)
        .is("imported_lead_id", null);
      return ok({ lead_id: existingLead.id, result_id: result.id, already_imported: true }, { requestId });
    }
    return fail("internal_error", "Não foi possível adicionar o resultado ao CRM.", 500, { requestId });
  }
}
