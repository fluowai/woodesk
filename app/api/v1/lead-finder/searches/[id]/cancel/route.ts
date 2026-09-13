import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_search_cancel" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("lead_finder_searches").update({ status: "cancelled", error_code: "cancelled_by_user", updated_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "queued").select("id, status, error_code, updated_at").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("invalid_state", "A busca não está mais na fila ou não foi encontrada.", 409, { requestId });
  return ok(data, { requestId });
}
