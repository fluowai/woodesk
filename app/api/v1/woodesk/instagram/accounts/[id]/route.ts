import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_instagram_disconnect" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: account, error: readError } = await supabase
    .from("instagram_accounts" as string)
    .select("id, instagram_business_account_id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (readError) return fail("internal_error", "Não foi possível consultar a conexão.", 500, { requestId });
  if (!account) return fail("not_found", "Conexão Instagram não encontrada.", 404, { requestId });
  const admin = createAdminClient();
  const instagramAccountsTable: string = "instagram_accounts";
  const { data: secret } = await admin.from(instagramAccountsTable).select("access_token_encrypted").eq("id", id).eq("organization_id", authz.org.orgId).maybeSingle();
  if (secret?.access_token_encrypted) {
    const { data: accessToken } = await admin.rpc("fn_decrypt_oauth", { ciphertext: secret.access_token_encrypted });
    if (typeof accessToken === "string" && accessToken) {
      try {
        await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v22.0"}/${encodeURIComponent(account.instagram_business_account_id)}/permissions`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      } catch {
        // A remoção local segura é preferível a manter a credencial por falha transitória da Meta.
      }
    }
  }
  const { error: deleteError } = await supabase.from("instagram_accounts" as string).delete().eq("id", id).eq("organization_id", authz.org.orgId);
  if (deleteError) return fail("internal_error", "Não foi possível remover a conexão.", 500, { requestId });
  await audit({ action: "woodesk.instagram_disconnected", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "instagram_account", resourceId: id, requestId, metadata: { instagram_business_account_id: account.instagram_business_account_id } });
  return ok({ id }, { requestId });
}
