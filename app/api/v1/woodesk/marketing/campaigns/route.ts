import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createCampaignDraft } from "@/lib/woodesk/campaigns";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(1).max(2000),
  channel: z.enum(["whatsapp", "instagram", "email", "sms", "voice"]),
  audience_filter: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_campaigns" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "marketing_calendar").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Campanhas não estão habilitadas para esta organização.", 403, { requestId });
  const status = request.nextUrl.searchParams.get("status");
  let query = supabase.from("marketing_campaigns").select("id, name, objective, channel, status, audience_filter, settings, starts_at, ends_at, approved_at, created_at, updated_at").eq("organization_id", authz.org.orgId).order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ campaigns: data ?? [] }, { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_campaigns" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Campanha inválida.", 422, { requestId });
  const draft = createCampaignDraft({
    organizationId: authz.org.orgId,
    name: parsed.data.name,
    objective: parsed.data.objective,
    channel: parsed.data.channel,
    audienceFilter: parsed.data.audience_filter,
    settings: parsed.data.settings,
    startsAt: parsed.data.starts_at,
    endsAt: parsed.data.ends_at,
  });
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "marketing_calendar").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Campanhas não estão habilitadas para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("marketing_campaigns").insert({
    organization_id: authz.org.orgId,
    name: draft.name,
    objective: draft.objective,
    channel: draft.channel,
    status: draft.status,
    audience_filter: draft.audienceFilter,
    settings: draft.settings,
    starts_at: draft.startsAt ?? null,
    ends_at: draft.endsAt ?? null,
    created_by: authz.user.id,
  }).select("id, name, objective, channel, status, audience_filter, settings, starts_at, ends_at, created_at").single();
  if (error || !data) return fail("internal_error", error?.message ?? "Campanha não criada.", 500, { requestId });
  return ok(data, { status: 201, requestId });
}
