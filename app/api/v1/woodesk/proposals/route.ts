import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createCommercialProposal } from "@/lib/woodesk/proposals";
import { recordUsageEvent } from "@/lib/woodesk/usage";

const itemSchema = z.object({ description: z.string().trim().min(1).max(500), quantity: z.number().positive(), unit_price_cents: z.number().int().nonnegative() });
const inputSchema = z.object({ title: z.string().trim().min(1).max(200), lead_id: z.string().uuid().optional(), contact_id: z.string().uuid().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), discount_cents: z.number().int().nonnegative().optional(), valid_until: z.string().date().optional(), terms: z.string().max(10000).optional(), items: z.array(itemSchema).min(1).max(100) });

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_proposals" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("commercial_proposals").select("id, lead_id, contact_id, status, currency, subtotal_cents, discount_cents, total_cents, valid_until, title, terms, accepted_at, created_at, updated_at, commercial_proposal_items(id, description, quantity, unit_price_cents, total_cents)").eq("organization_id", authz.org.orgId).order("updated_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ proposals: data ?? [] }, { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_proposals" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("validation_failed", "Proposta inválida.", 422, { requestId });
  try {
    const draft = createCommercialProposal({ organizationId: authz.org.orgId, title: parsed.data.title, leadId: parsed.data.lead_id, contactId: parsed.data.contact_id, currency: parsed.data.currency, discountCents: parsed.data.discount_cents, validUntil: parsed.data.valid_until, terms: parsed.data.terms, items: parsed.data.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPriceCents: item.unit_price_cents })) });
    const supabase = await createClient();
    const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "sales_proposals").maybeSingle();
    if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
    if (!flag?.enabled) return fail("feature_disabled", "Propostas comerciais não estão habilitadas para esta organização.", 403, { requestId });
    const { data: proposal, error } = await supabase.from("commercial_proposals").insert({ organization_id: authz.org.orgId, lead_id: draft.leadId ?? null, contact_id: draft.contactId ?? null, title: draft.title, currency: draft.currency, subtotal_cents: draft.subtotalCents, discount_cents: draft.discountCents, total_cents: draft.totalCents, valid_until: draft.validUntil ?? null, terms: draft.terms ?? null, created_by: authz.user.id }).select("id, status, title, subtotal_cents, discount_cents, total_cents, created_at").single();
    if (error || !proposal) return fail("internal_error", error?.message ?? "Proposta não criada.", 500, { requestId });
    const { error: itemError } = await supabase.from("commercial_proposal_items").insert(draft.items.map((item) => ({ organization_id: authz.org.orgId, proposal_id: proposal.id, description: item.description, quantity: item.quantity, unit_price_cents: item.unitPriceCents, total_cents: item.totalCents })));
    if (itemError) {
      await supabase.from("commercial_proposals").delete().eq("organization_id", authz.org.orgId).eq("id", proposal.id);
      return fail("internal_error", itemError.message, 500, { requestId });
    }
    await recordUsageEvent(supabase, { organizationId: authz.org.orgId, capability: "sales_proposals", idempotencyKey: `proposal:${proposal.id}`, metadata: { total_cents: proposal.total_cents } });
    return ok(proposal, { status: 201, requestId });
  } catch (error) {
    return fail("validation_failed", error instanceof Error ? error.message : "Proposta inválida.", 422, { requestId });
  }
}
