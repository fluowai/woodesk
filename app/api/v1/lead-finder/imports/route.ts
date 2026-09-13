import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { normalizeBrowserLead } from "@/lib/woodesk/providers/browser-import";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(240), category: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(80).optional(), website: z.string().url().max(1000).optional(),
  instagram: z.string().trim().max(240).optional(), address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(), state: z.string().trim().max(80).optional(),
  rating: z.coerce.number().min(0).max(5).optional(), reviewCount: z.coerce.number().int().nonnegative().optional(),
  sourceUrl: z.string().url().max(1000).optional(), externalId: z.string().trim().max(240).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(),
}).passthrough();

const bodySchema = z.object({ leads: z.array(leadSchema).min(1).max(500), query: z.record(z.string(), z.unknown()).optional() });

function parseCsv(text: string): unknown[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  const headers = (rows.shift() ?? []).map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  const aliases: Record<string, string> = { nome: "name", name: "name", empresa: "name", business_name: "name", categoria: "category", category: "category", telefone: "phone", phone: "phone", site: "website", website: "website", endereco: "address", address: "address", cidade: "city", city: "city", estado: "state", state: "state", nota: "rating", rating: "rating", avaliacoes: "reviewCount", reviews: "reviewCount", review_count: "reviewCount", instagram: "instagram", url: "sourceUrl", source_url: "sourceUrl", place_id: "externalId", external_id: "externalId", latitude: "latitude", longitude: "longitude" };
  return rows.map((values) => Object.fromEntries(values.map((value, index) => [aliases[headers[index] ?? ""] ?? headers[index], value]).filter(([key]) => Boolean(key))));
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "lead_finder_imports" });
  if (!authz.ok) return authz.response;
  const contentType = request.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) body = { leads: parseCsv(await file.text()) };
  } else if (contentType.includes("text/csv")) {
    body = { leads: parseCsv(await request.text()) };
  } else body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("invalid_request", "Envie um JSON com leads extraídos pelo navegador.", 400, { requestId });
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "lead_finder").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Lead Finder não está habilitado para esta organização.", 403, { requestId });
  const { data: search, error: searchError } = await supabase.from("lead_finder_searches").insert({ organization_id: authz.org.orgId, requested_by: authz.user.id, provider_id: "browser_import", status: "running", query: parsed.data.query ?? { source: "browser_import" } }).select("id").single();
  if (searchError || !search) return fail("internal_error", searchError?.message ?? "Importação não criada.", 500, { requestId });
  const rows = parsed.data.leads.map((input) => { const result = normalizeBrowserLead(input); return { organization_id: authz.org.orgId, search_id: search.id, external_id: result.externalId ?? null, source_url: result.sourceUrl ?? null, name: result.name, category: result.category ?? null, phone: result.phone ?? null, website: result.website ?? null, instagram: result.instagram ?? null, address: result.address ?? null, city: result.city ?? null, state: result.state ?? null, rating: result.rating ?? null, review_count: result.reviewCount ?? null, latitude: result.latitude ?? null, longitude: result.longitude ?? null, normalized_phone: result.normalizedPhone, has_whatsapp: result.hasWhatsapp, raw_data: input }; });
  const { data: inserted, error: insertError } = await supabase.from("lead_finder_results").upsert(rows, { onConflict: "organization_id,search_id,external_id", ignoreDuplicates: true }).select("id");
  if (insertError) { await supabase.from("lead_finder_searches").update({ status: "failed", error_code: "import_failed", finished_at: new Date().toISOString() }).eq("id", search.id).eq("organization_id", authz.org.orgId); return fail("internal_error", insertError.message, 500, { requestId }); }
  await supabase.from("lead_finder_searches").update({ status: "completed", result_count: inserted?.length ?? 0, finished_at: new Date().toISOString() }).eq("id", search.id).eq("organization_id", authz.org.orgId);
  return ok({ search_id: search.id, imported: inserted?.length ?? 0, provider_id: "browser_import" }, { status: 201, requestId });
}
