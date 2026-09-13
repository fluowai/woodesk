import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createContentDraft, type ContentBrief } from "@/lib/woodesk/content";
import { decideEntitlement } from "@/lib/woodesk/entitlements";
import { recordUsageEvent } from "@/lib/woodesk/usage";

const inputSchema = z.object({
  channel: z.enum(["instagram", "whatsapp", "email", "sms", "voice"]),
  content_type: z.enum(["post", "story", "reel", "carousel", "caption", "script", "email"]),
  business_context: z.string().trim().min(1).max(4000),
  audience: z.string().trim().min(1).max(1000),
  tone: z.string().trim().min(1).max(500),
  objective: z.string().trim().min(1).max(1000),
  body: z.string().trim().min(1).max(20_000),
  title: z.string().trim().max(200).optional(),
  instagram_account_id: z.string().uuid().optional(),
  media_url: z.string().url().refine((value) => value.startsWith("https://"), "A mídia precisa usar HTTPS.").optional(),
  media_urls: z.array(z.string().url().refine((value) => value.startsWith("https://"), "A mídia precisa usar HTTPS.")).max(10).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_content" });
  if (!authz.ok) return authz.response;
  const channel = request.nextUrl.searchParams.get("channel");
  const status = request.nextUrl.searchParams.get("status");
  const supabase = await createClient();
  const feature = channel === "instagram" ? "instagram_studio" : "marketing_calendar";
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", feature).maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Conteúdo não está habilitado para esta organização.", 403, { requestId });
  let query = supabase.from("marketing_contents").select("id, channel, content_type, status, title, body, media, context, approved_by, approved_at, created_at, updated_at").eq("organization_id", authz.org.orgId).order("updated_at", { ascending: false }).limit(100);
  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ contents: data ?? [] }, { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_content" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Brief ou conteúdo inválido.", 422, { requestId });
  if (parsed.data.instagram_account_id && parsed.data.channel !== "instagram") {
    return fail("validation_failed", "A conta Instagram só pode ser usada em conteúdo do Instagram.", 422, { requestId });
  }

  const feature = parsed.data.channel === "instagram" ? "instagram_studio" : "marketing_calendar";
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("organization_id", authz.org.orgId)
    .eq("key", feature)
    .maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Esta capacidade não está habilitada para a organização.", 403, { requestId });
  const { data: organization, error: organizationError } = await supabase.from("organizations").select("plan_id").eq("id", authz.org.orgId).maybeSingle();
  if (organizationError) return fail("internal_error", organizationError.message, 500, { requestId });
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: contentsThisMonth, error: usageError } = await supabase.from("marketing_contents").select("id", { count: "exact", head: true }).eq("organization_id", authz.org.orgId).gte("created_at", monthStart.toISOString());
  if (usageError) return fail("internal_error", usageError.message, 500, { requestId });
  const { data: entitlement, error: entitlementError } = await supabase.from("plan_entitlements").select("enabled, monthly_limit").eq("plan_id", organization?.plan_id ?? "").eq("capability", "content_generation").maybeSingle();
  if (entitlementError) return fail("internal_error", entitlementError.message, 500, { requestId });
  const decision = decideEntitlement(entitlement ? { enabled: entitlement.enabled, monthlyLimit: entitlement.monthly_limit } : null, contentsThisMonth ?? 0);
  if (!decision.allowed) return fail("plan_limit_reached", `Geração de conteúdo bloqueada pelo entitlement: ${decision.reason}.`, 403, { requestId });

  const brief: ContentBrief = {
    organizationId: authz.org.orgId,
    channel: parsed.data.channel,
    contentType: parsed.data.content_type,
    businessContext: parsed.data.business_context,
    audience: parsed.data.audience,
    tone: parsed.data.tone,
    objective: parsed.data.objective,
  };
  if (parsed.data.instagram_account_id) {
    const { data: instagramAccount, error: instagramAccountError } = await supabase
      .from("instagram_accounts" as string)
      .select("id")
      .eq("id", parsed.data.instagram_account_id)
      .eq("organization_id", authz.org.orgId)
      .eq("status", "connected")
      .maybeSingle();
    if (instagramAccountError) return fail("internal_error", instagramAccountError.message, 500, { requestId });
    if (!instagramAccount) return fail("not_found", "Conta Instagram não encontrada ou desconectada.", 404, { requestId });
  }
  const draft = createContentDraft(brief, parsed.data.body, parsed.data.title);
  const media = parsed.data.media_urls?.length ? parsed.data.media_urls : parsed.data.media_url ? [parsed.data.media_url] : [];
  const { data: created, error } = await supabase
    .from("marketing_contents")
    .insert({
      organization_id: authz.org.orgId,
      channel: draft.context.channel,
      content_type: draft.context.contentType,
      status: "draft",
      title: draft.title ?? null,
      body: draft.body,
      media,
      context: { ...draft.context, ...(parsed.data.instagram_account_id ? { instagram_account_id: parsed.data.instagram_account_id } : {}) },
      created_by: authz.user.id,
    })
    .select("id, channel, content_type, status, title, body, media, context, created_at")
    .single();
  if (error || !created) return fail("internal_error", error?.message ?? "Rascunho não criado.", 500, { requestId });
  await recordUsageEvent(supabase, { organizationId: authz.org.orgId, capability: "content_generation", idempotencyKey: `content:${created.id}` });
  return ok({ ...created, requires_approval: draft.requiresApproval }, { status: 201, requestId });
}
