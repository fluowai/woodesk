import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_proposal_send" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("commercial_proposals").update({ status: "sent", public_token_hash: tokenHash, public_token_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "draft").select("id, status, title, total_cents, public_token_expires_at, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("invalid_state", "A proposta não está em rascunho ou não foi encontrada.", 409, { requestId });
  const notificationsTable: string = "woodesk_notifications";
  // Best-effort: a retry pode encontrar a chave única já gravada.
  await supabase.from(notificationsTable).insert({ organization_id: authz.org.orgId, user_id: null, kind: "proposal_sent", idempotency_key: `proposal:${data.id}:sent`, title: "Proposta enviada", body: `A proposta ${data.title} foi enviada para aceite.`, metadata: { proposal_id: data.id } });
  return ok({ ...data, public_token: token }, { requestId });
}
