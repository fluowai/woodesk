import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({ keyword: z.string().trim().min(2).max(200), target_business_name: z.string().trim().min(2).max(200), locale: z.string().trim().min(2).max(20).default("pt-BR") });

async function assertFeature(organizationId: string, requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_flags").select("enabled").eq("organization_id", organizationId).eq("key", "local_seo").maybeSingle();
  if (error) return { response: fail("internal_error", error.message, 500, { requestId }) } as const;
  if (!data?.enabled) return { response: fail("feature_disabled", "Local SEO não está habilitado para esta organização.", 403, { requestId }) } as const;
  return { supabase } as const;
}

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo_keywords" });
  if (!authz.ok) return authz.response;
  const checked = await assertFeature(authz.org.orgId, requestId);
  if ("response" in checked) return checked.response as Response;
  const keywordsTable: string = "local_keywords";
  const { data, error } = await checked.supabase.from(keywordsTable).select("id, keyword, target_business_name, locale, active, created_at").eq("organization_id", authz.org.orgId).order("keyword", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ keywords: data ?? [] }, { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_local_seo_keywords" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Palavra-chave inválida.", 422, { requestId });
  const checked = await assertFeature(authz.org.orgId, requestId);
  if ("response" in checked) return checked.response as Response;
  const keywordsTable: string = "local_keywords";
  const { data, error } = await checked.supabase.from(keywordsTable).upsert({ organization_id: authz.org.orgId, keyword: parsed.data.keyword, target_business_name: parsed.data.target_business_name, locale: parsed.data.locale, active: true }, { onConflict: "organization_id,keyword,locale" }).select("id, keyword, target_business_name, locale, active, created_at").single();
  if (error || !data) return fail("internal_error", error?.message ?? "Palavra-chave não criada.", 500, { requestId });
  return ok(data, { status: 201, requestId });
}
