import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_proposal_reject" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("commercial_proposals").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).eq("id", id).in("status", ["draft", "sent"]).select("id, status, title, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("invalid_state", "A proposta não pode ser rejeitada neste estado ou não foi encontrada.", 409, { requestId });
  const notificationsTable: string = "woodesk_notifications";
  await supabase.from(notificationsTable).insert({ organization_id: authz.org.orgId, user_id: null, kind: "proposal_rejected", idempotency_key: `proposal:${data.id}:rejected`, title: "Proposta rejeitada", body: `A proposta ${data.title} foi marcada como rejeitada.`, metadata: { proposal_id: data.id } });
  return ok(data, { requestId });
}
