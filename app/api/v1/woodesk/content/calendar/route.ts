import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_content_calendar" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flags, error: flagError } = await supabase.from("feature_flags").select("key, enabled").eq("organization_id", authz.org.orgId).in("key", ["marketing_calendar", "instagram_studio"]);
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flags?.some((flag) => flag.enabled)) return fail("feature_disabled", "Calendário de conteúdo não está habilitado para esta organização.", 403, { requestId });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return fail("validation_failed", "Janela de calendário inválida.", 422, { requestId });

  const from = parsed.data.from ?? new Date().toISOString();
  const to = parsed.data.to ?? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
  if (new Date(from) >= new Date(to)) return fail("validation_failed", "A data inicial deve ser anterior à final.", 422, { requestId });

  const { data, error } = await supabase
    .from("content_calendar_items")
    .select("id, content_id, scheduled_for, timezone, status, provider_id, external_id, error_code, marketing_contents(id, channel, content_type, status, title, body)")
    .eq("organization_id", authz.org.orgId)
    .gte("scheduled_for", from)
    .lt("scheduled_for", to)
    .order("scheduled_for", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ from, to, items: data ?? [] }, { requestId });
}
