import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_instagram_accounts" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "instagram_studio").maybeSingle();
  if (flagError) return fail("internal_error", "Não foi possível consultar a capacidade do Instagram.", 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Instagram Studio não está habilitado para esta organização.", 403, { requestId });
  const accountsTable: string = "instagram_accounts";
  const { data, error } = await supabase
    .from(accountsTable)
    .select("id, instagram_business_account_id, page_id, username, token_expires_at, status, created_at, updated_at")
    .eq("organization_id", authz.org.orgId)
    .order("updated_at", { ascending: false });
  if (error) return fail("internal_error", "Não foi possível consultar as contas do Instagram.", 500, { requestId });
  return ok(data ?? [], { requestId });
}
