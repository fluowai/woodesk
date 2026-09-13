import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_content_approval" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "Conteúdo inválido.", 422, { requestId });

  const supabase = await createClient();
  const { data: content, error: readError } = await supabase
    .from("marketing_contents")
    .select("id, channel, status")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (readError) return fail("internal_error", readError.message, 500, { requestId });
  if (!content) return fail("not_found", "Conteúdo não encontrado.", 404, { requestId });
  const feature = content.channel === "instagram" ? "instagram_studio" : "marketing_calendar";
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", feature).maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Studio de conteúdo não está habilitado para esta organização.", 403, { requestId });
  if (content.status !== "draft" && content.status !== "review") {
    return fail("conflict", "Somente rascunhos em revisão podem ser aprovados.", 409, { requestId });
  }

  const { data: approved, error } = await supabase
    .from("marketing_contents")
    .update({ status: "approved", approved_by: authz.user.id, approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .in("status", ["draft", "review"])
    .select("id, status, approved_by, approved_at")
    .single();
  if (error || !approved) return fail("internal_error", error?.message ?? "Aprovação não registrada.", 500, { requestId });
  return ok(approved, { requestId });
}
