import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const inputSchema = z.object({ pipeline_id: z.string().uuid(), won_stage_id: z.string().uuid() }).partial();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_proposal_accept" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success || (parsed.data.pipeline_id && !parsed.data.won_stage_id) || (!parsed.data.pipeline_id && parsed.data.won_stage_id)) {
    return fail("validation_failed", "Pipeline e etapa vencedora devem ser informados juntos.", 422, { requestId });
  }
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  if (parsed.data.pipeline_id && parsed.data.won_stage_id) {
    const { data: stage, error: stageError } = await supabase.from("crm_stages").select("id, pipeline_id, is_won").eq("organization_id", authz.org.orgId).eq("id", parsed.data.won_stage_id).eq("pipeline_id", parsed.data.pipeline_id).maybeSingle();
    if (stageError) return fail("internal_error", stageError.message, 500, { requestId });
    if (!stage?.is_won) return fail("validation_failed", "A etapa informada não é uma etapa vencedora.", 422, { requestId });
    const { data: proposal, error: proposalError } = await supabase.from("commercial_proposals").select("lead_id").eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "sent").maybeSingle();
    if (proposalError) return fail("internal_error", proposalError.message, 500, { requestId });
    if (!proposal?.lead_id) return fail("validation_failed", "A proposta não possui lead vinculado para mover no pipeline.", 422, { requestId });
  }
  const acceptedAt = new Date().toISOString();
  const { data, error } = await supabase.from("commercial_proposals").update({ status: "accepted", accepted_at: acceptedAt, updated_at: acceptedAt }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "sent").select("id, lead_id, status, title, total_cents, accepted_at, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("invalid_state", "A proposta precisa estar enviada para ser aceita.", 409, { requestId });
  const notificationsTable: string = "woodesk_notifications";
  await supabase.from(notificationsTable).insert({ organization_id: authz.org.orgId, user_id: null, kind: "proposal_accepted", idempotency_key: `proposal:${data.id}:accepted`, title: "Proposta aceita", body: `A proposta ${data.title} foi aceita.`, metadata: { proposal_id: data.id } });
  if (parsed.data.pipeline_id && parsed.data.won_stage_id) {
    const { data: stage, error: stageError } = await supabase.from("crm_stages").select("id, pipeline_id, is_won").eq("organization_id", authz.org.orgId).eq("id", parsed.data.won_stage_id).eq("pipeline_id", parsed.data.pipeline_id).maybeSingle();
    if (stageError || !stage) return fail("internal_error", stageError?.message ?? "Etapa não encontrada.", 500, { requestId });
    const { data: lead, error: leadError } = await supabase.from("crm_leads").update({ pipeline_id: stage.pipeline_id, stage_id: stage.id, status: "won", closed_at: acceptedAt }).eq("organization_id", authz.org.orgId).eq("id", data.lead_id).select("id, pipeline_id, stage_id, status, closed_at").maybeSingle();
    if (leadError) return fail("internal_error", leadError.message, 500, { requestId });
    if (!lead) return fail("not_found", "Lead vinculado não encontrado.", 404, { requestId });
    return ok({ ...data, lead }, { requestId });
  }
  return ok(data, { requestId });
}
