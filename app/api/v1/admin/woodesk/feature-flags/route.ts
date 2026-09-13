import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { isWoodeskFeatureFlag, WOODESK_FEATURE_FLAGS } from "@/lib/woodesk/feature-flags";

const organizationId = z.string().uuid();
const key = z.string().refine(isWoodeskFeatureFlag, "Flag Woodesk inválida.");
const querySchema = z.object({ organization_id: organizationId });
const mutationSchema = z.object({ organization_id: organizationId, key, enabled: z.boolean(), config: z.record(z.string(), z.unknown()).default({}) });

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try { adminCtx = await requirePlatformAdmin(); } catch { return fail("forbidden", "Platform admin required.", 403, { requestId }); }
  const parsed = querySchema.safeParse({ organization_id: request.nextUrl.searchParams.get("organization_id") });
  if (!parsed.success) return fail("validation_failed", "Organização inválida.", 422, { requestId });
  const db = createAdminClient();
  const flagsTable: string = "feature_flags";
  const { data: organization, error: organizationError } = await db.from("organizations").select("id").eq("id", parsed.data.organization_id).maybeSingle();
  if (organizationError) return fail("internal_error", "Não foi possível validar a organização.", 500, { requestId });
  if (!organization) return fail("not_found", "Organização não encontrada.", 404, { requestId });
  const { data, error } = await db.from(flagsTable).select("key, enabled, config, updated_at").eq("organization_id", parsed.data.organization_id).order("key");
  if (error) return fail("internal_error", "Não foi possível carregar as flags.", 500, { requestId });
  void audit({ action: "platform_admin.woodesk_flags_listed", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, requestId, organizationId: parsed.data.organization_id });
  const configured = new Map((data ?? []).map((flag) => [flag.key, flag]));
  const flags = WOODESK_FEATURE_FLAGS.map((flagKey) => configured.get(flagKey) ?? { key: flagKey, enabled: false, config: {}, updated_at: null });
  return ok({ organization_id: parsed.data.organization_id, flags }, { requestId });
}

export async function PUT(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try { adminCtx = await requirePlatformAdmin(); } catch { return fail("forbidden", "Platform admin required.", 403, { requestId }); }
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Flag ou organização inválida.", 422, { requestId });
  const db = createAdminClient();
  const flagsTable: string = "feature_flags";
  const { data: organization, error: organizationError } = await db.from("organizations").select("id").eq("id", parsed.data.organization_id).maybeSingle();
  if (organizationError) return fail("internal_error", "Não foi possível validar a organização.", 500, { requestId });
  if (!organization) return fail("not_found", "Organização não encontrada.", 404, { requestId });
  const { data, error } = await db.from(flagsTable).upsert({ organization_id: parsed.data.organization_id, key: parsed.data.key, enabled: parsed.data.enabled, config: parsed.data.config, updated_at: new Date().toISOString() }, { onConflict: "organization_id,key" }).select("key, enabled, config, updated_at").single();
  if (error || !data) return fail("internal_error", "Não foi possível atualizar a flag.", 500, { requestId });
  void audit({ action: "platform_admin.woodesk_flag_updated", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, requestId, organizationId: parsed.data.organization_id, metadata: { key: parsed.data.key, enabled: parsed.data.enabled } });
  return ok(data, { requestId });
}
