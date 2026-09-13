import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/agent-engine/queue/queue";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";

const inputSchema = z.object({
  scheduled_for: z.string().datetime({ offset: true }).optional(),
  publish_now: z.boolean().default(false),
  timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_content_schedule" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return fail("validation_failed", "Conteúdo inválido.", 422, { requestId });

  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Data de agendamento inválida.", 422, { requestId });
  if (!parsed.data.scheduled_for && !parsed.data.publish_now) return fail("validation_failed", "Informe a data ou solicite publicação imediata.", 422, { requestId });
  const scheduledAt = parsed.data.publish_now ? new Date(Date.now() + 1000) : new Date(parsed.data.scheduled_for as string);
  if (scheduledAt.getTime() <= Date.now()) return fail("validation_failed", "O agendamento deve estar no futuro.", 422, { requestId });

  const supabase = await createClient();
  const { data: content, error: contentError } = await supabase
    .from("marketing_contents")
    .select("id, channel, status")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (contentError) return fail("internal_error", contentError.message, 500, { requestId });
  if (!content) return fail("not_found", "Conteúdo não encontrado.", 404, { requestId });
  const feature = content.channel === "instagram" ? "instagram_studio" : "marketing_calendar";
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", feature).maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Calendário de conteúdo não está habilitado para esta organização.", 403, { requestId });
  if (content.status !== "approved") return fail("conflict", "Somente conteúdo aprovado pode ser agendado.", 409, { requestId });

  const { data: item, error } = await supabase
    .from("content_calendar_items")
    .insert({
      organization_id: authz.org.orgId,
      content_id: id,
      scheduled_for: scheduledAt.toISOString(),
      timezone: parsed.data.timezone,
      status: "scheduled",
    })
    .select("id, content_id, scheduled_for, timezone, status, created_at")
    .single();
  if (error || !item) {
    const duplicate = error?.code === "23505";
    return fail(duplicate ? "conflict" : "internal_error", duplicate ? "Este conteúdo já está agendado para esse horário." : "Agendamento não criado.", duplicate ? 409 : 500, { requestId });
  }
  const { error: statusError } = await supabase
    .from("marketing_contents")
    .update({ status: "scheduled" })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .eq("status", "approved");
  if (statusError) return fail("internal_error", statusError.message, 500, { requestId });
  try {
    const { job, deduped } = await enqueueJob(getRequestPool(), authz.org.orgId, { kind: "content_publish", payload: { calendar_item_id: item.id }, runAfter: scheduledAt, maxAttempts: 3 });
    return ok({ ...item, job_id: job.id, deduped }, { status: 201, requestId });
  } catch {
    await supabase.from("content_calendar_items").update({ status: "failed", error_code: "queue_unavailable" }).eq("id", item.id).eq("organization_id", authz.org.orgId);
    await supabase.from("marketing_contents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", authz.org.orgId).eq("status", "scheduled");
    return fail("service_unavailable", "Não foi possível enfileirar a publicação.", 503, { requestId });
  }
}
