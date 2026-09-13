import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  provider_id: z.string().min(1).max(80),
  keyword: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(80).optional(),
  radius_km: z.number().int().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  minimum_rating: z.number().min(0).max(5).optional(),
  maximum_rating: z.number().min(0).max(5).optional(),
  minimum_review_count: z.number().int().nonnegative().optional(),
  maximum_review_count: z.number().int().nonnegative().optional(),
  has_website: z.boolean().optional(),
  has_whatsapp: z.boolean().optional(),
  has_instagram: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.maximum_rating !== undefined && value.minimum_rating !== undefined && value.maximum_rating < value.minimum_rating) context.addIssue({ code: "custom", path: ["maximum_rating"], message: "maximum_rating must be greater than or equal to minimum_rating" });
  if (value.maximum_review_count !== undefined && value.minimum_review_count !== undefined && value.maximum_review_count < value.minimum_review_count) context.addIssue({ code: "custom", path: ["maximum_review_count"], message: "maximum_review_count must be greater than or equal to minimum_review_count" });
});

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_searches" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  const status = request.nextUrl.searchParams.get("status");
  let query = supabase.from("lead_finder_searches").select("id, provider_id, status, query, result_count, error_code, started_at, finished_at, created_at, updated_at").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ searches: data ?? [] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_searches" });
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "JSON inválido.", 400, { requestId });
  }
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", "Parâmetros de busca inválidos.", 400, { requestId });
  }

  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("organization_id", authz.org.orgId)
    .eq("key", "lead_finder")
    .maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });

  return fail("browser_import_required", "Use a importação CSV/JSON do extractor de navegador; o Lead Finder não usa API do Google.", 409, { requestId });
}
