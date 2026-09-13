import { createHash, randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ signed_name: z.string().trim().min(2).max(160) });

async function readProposal(token: string) {
  const supabase = createAdminClient();
  const hash = createHash("sha256").update(token).digest("hex");
  return supabase.from("commercial_proposals")
    .select("id, status, title, currency, subtotal_cents, discount_cents, total_cents, valid_until, terms, public_token_expires_at, signed_at, signed_name, commercial_proposal_items(id, description, quantity, unit_price_cents, total_cents)")
    .eq("public_token_hash", hash).maybeSingle();
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await context.params;
  const { data, error } = await readProposal(token);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data || !data.public_token_expires_at || new Date(data.public_token_expires_at) <= new Date()) return fail("not_found", "Proposta não encontrada ou expirada.", 404, { requestId });
  return ok({ id: data.id, status: data.status, title: data.title, currency: data.currency, subtotal_cents: data.subtotal_cents, discount_cents: data.discount_cents, total_cents: data.total_cents, valid_until: data.valid_until, terms: data.terms, signed_at: data.signed_at, signed_name: data.signed_name, items: data.commercial_proposal_items }, { requestId });
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Nome para assinatura é obrigatório.", 422, { requestId });
  const { data, error } = await readProposal(token);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data || data.status !== "sent" || !data.public_token_expires_at || new Date(data.public_token_expires_at) <= new Date()) return fail("invalid_state", "Proposta não encontrada, expirada ou já processada.", 409, { requestId });
  const supabase = createAdminClient();
  const signedAt = new Date().toISOString();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: signed, error: signError } = await supabase.from("commercial_proposals").update({ status: "accepted", signed_at: signedAt, signed_name: parsed.data.signed_name, accepted_at: signedAt, updated_at: signedAt }).eq("public_token_hash", hash).eq("status", "sent").select("id, status, signed_at, signed_name, accepted_at").maybeSingle();
  if (signError) return fail("internal_error", signError.message, 500, { requestId });
  if (!signed) return fail("invalid_state", "A proposta já foi processada.", 409, { requestId });
  return ok(signed, { requestId });
}
