import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createCommercialProposal } from "@/lib/woodesk/proposals";

const itemSchema = z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().positive(), unit_price_cents: z.number().int().nonnegative() });
const updateSchema = z.object({ title: z.string().trim().min(1).max(200), currency: z.string().regex(/^[A-Z]{3}$/).optional(), discount_cents: z.number().int().nonnegative().optional(), valid_until: z.string().date().optional(), terms: z.string().max(10000).optional(), items: z.array(itemSchema).min(1).max(100) });

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_proposals" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("commercial_proposals").select("id, lead_id, contact_id, status, currency, subtotal_cents, discount_cents, total_cents, valid_until, title, terms, accepted_at, created_at, updated_at, commercial_proposal_items(id, description, quantity, unit_price_cents, total_cents)").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Proposta não encontrada.", 404, { requestId });
  return ok(data, { requestId });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_proposals" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Proposta inválida.", 422, { requestId });
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  try {
    const draft = createCommercialProposal({ organizationId: authz.org.orgId, title: parsed.data.title, currency: parsed.data.currency, discountCents: parsed.data.discount_cents, validUntil: parsed.data.valid_until, terms: parsed.data.terms, items: parsed.data.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPriceCents: item.unit_price_cents })) });
    const { data: proposal, error } = await supabase.from("commercial_proposals").update({ title: draft.title, currency: draft.currency, subtotal_cents: draft.subtotalCents, discount_cents: draft.discountCents, total_cents: draft.totalCents, valid_until: draft.validUntil ?? null, terms: draft.terms ?? null, updated_at: new Date().toISOString() }).eq("organization_id", authz.org.orgId).eq("id", id).eq("status", "draft").select("id, status, title, currency, subtotal_cents, discount_cents, total_cents, valid_until, terms, updated_at").maybeSingle();
    if (error) return fail("internal_error", error.message, 500, { requestId });
    if (!proposal) return fail("invalid_state", "A proposta não está em rascunho ou não foi encontrada.", 409, { requestId });
    const { error: deleteError } = await supabase.from("commercial_proposal_items").delete().eq("organization_id", authz.org.orgId).eq("proposal_id", id);
    if (deleteError) return fail("internal_error", deleteError.message, 500, { requestId });
    const { error: itemError } = await supabase.from("commercial_proposal_items").insert(draft.items.map((item) => ({ organization_id: authz.org.orgId, proposal_id: id, description: item.description, quantity: item.quantity, unit_price_cents: item.unitPriceCents, total_cents: item.totalCents })));
    if (itemError) return fail("internal_error", itemError.message, 500, { requestId });
    return ok(proposal, { requestId });
  } catch (error) {
    return fail("validation_failed", error instanceof Error ? error.message : "Proposta inválida.", 422, { requestId });
  }
}
