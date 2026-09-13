import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";

const inputSchema = z.object({ action: z.enum(["reject", "import"]), result_ids: z.array(z.string().uuid()).min(1).max(100), pipeline_id: z.string().uuid().optional(), stage_id: z.string().uuid().optional() });

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_batch" });
  if (!authz.ok) return authz.response;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("validation_failed", "Ação em lote inválida.", 422, { requestId });
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  if (parsed.data.action === "import" && (!parsed.data.pipeline_id || !parsed.data.stage_id)) return fail("validation_failed", "Pipeline e etapa são obrigatórios para importar.", 422, { requestId });
  if (parsed.data.action === "import") {
    const { data: results, error: resultError } = await supabase.from("lead_finder_results").select("id, name, category, phone, website, address, city, state, source_url, external_id, imported_lead_id, status").eq("organization_id", authz.org.orgId).in("id", parsed.data.result_ids);
    if (resultError) return fail("internal_error", resultError.message, 500, { requestId });
    let imported = 0;
    for (const result of results ?? []) {
      if (result.imported_lead_id) continue;
      try {
        const lead = await createLeadHandler(supabase, { organization_id: authz.org.orgId, actor: { type: "user", id: authz.user.id }, requestId, idioma: authz.user.idioma }, { pipeline_id: parsed.data.pipeline_id as string, stage_id: parsed.data.stage_id as string, title: result.name, description: [result.address, result.city, result.state].filter(Boolean).join(", ") || null, contact_id: null, currency: "BRL", tags: result.category ? [result.category] : [], source: "browser_import", external_id: `woodesk-lead-finder:${result.id}`, custom_fields: { lead_finder_result_id: result.id, phone: result.phone, website: result.website, source_url: result.source_url, external_id: result.external_id } });
        if (typeof lead.id !== "string") continue;
        await supabase.from("lead_finder_results").update({ imported_lead_id: lead.id, status: "imported" }).eq("id", result.id).eq("organization_id", authz.org.orgId).is("imported_lead_id", null);
        imported += 1;
      } catch { /* preserva o restante do lote; o retorno informa o que foi concluído */ }
    }
    return ok({ imported, requested: parsed.data.result_ids.length }, { requestId });
  }
  const { data, error } = await supabase.from("lead_finder_results").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).in("id", parsed.data.result_ids).in("status", ["new", "duplicate"]).select("id");
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ updated: data?.length ?? 0, requested: parsed.data.result_ids.length }, { requestId });
}
