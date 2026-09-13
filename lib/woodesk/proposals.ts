export interface ProposalItemInput { description: string; quantity: number; unitPriceCents: number }
export interface CommercialProposalInput { organizationId: string; title: string; leadId?: string; contactId?: string; currency?: string; discountCents?: number; validUntil?: string; terms?: string; items: ProposalItemInput[] }
export interface CommercialProposalDraft { organizationId: string; title: string; leadId?: string; contactId?: string; currency: string; subtotalCents: number; discountCents: number; totalCents: number; validUntil?: string; terms?: string; items: Array<ProposalItemInput & { totalCents: number }> }

export function createCommercialProposal(input: CommercialProposalInput): CommercialProposalDraft {
  const organizationId = input.organizationId.trim();
  const title = input.title.trim();
  if (!organizationId || !title || input.items.length === 0) throw new Error("proposal_required_fields");
  const items = input.items.map((item) => {
    if (!item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) throw new Error("proposal_item_invalid");
    return { ...item, description: item.description.trim(), totalCents: Math.round(item.quantity * item.unitPriceCents) };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const discountCents = input.discountCents ?? 0;
  if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents) throw new Error("proposal_discount_invalid");
  return { organizationId, title, ...(input.leadId ? { leadId: input.leadId } : {}), ...(input.contactId ? { contactId: input.contactId } : {}), currency: input.currency ?? "BRL", subtotalCents, discountCents, totalCents: subtotalCents - discountCents, ...(input.validUntil ? { validUntil: input.validUntil } : {}), ...(input.terms ? { terms: input.terms } : {}), items };
}
