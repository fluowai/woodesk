import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_campaign_approval" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "marketing_calendar").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Campanhas não estão habilitadas para esta organização.", 403, { requestId });
  const { data: campaign, error: readError } = await supabase.from("marketing_campaigns").select("id, status").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (readError) return fail("internal_error", readError.message, 500, { requestId });
  if (!campaign) return fail("not_found", "Campanha não encontrada.", 404, { requestId });
  if (campaign.status !== "review") return fail("invalid_state", "A campanha precisa estar em revisão para aprovação.", 409, { requestId });
  const { data, error } = await supabase.from("marketing_campaigns").update({ status: "approved", approved_by: authz.user.id, approved_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "review").select("id, status, approved_by, approved_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("conflict", "A campanha foi alterada antes da aprovação.", 409, { requestId });
  return ok(data, { requestId });
}
