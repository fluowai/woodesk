import { describe, expect, it } from "vitest";
import { createCommercialProposal } from "./proposals";

describe("commercial proposals", () => {
  it("calculates item totals, subtotal and discount", () => {
    const draft = createCommercialProposal({ organizationId: "org", title: "Plano Growth", items: [{ description: "Setup", quantity: 2, unitPriceCents: 15000 }], discountCents: 500 });
    expect(draft).toMatchObject({ subtotalCents: 30000, discountCents: 500, totalCents: 29500 });
  });
  it("rejects discounts above subtotal", () => {
    expect(() => createCommercialProposal({ organizationId: "org", title: "Plano", items: [{ description: "Item", quantity: 1, unitPriceCents: 100 }], discountCents: 101 })).toThrow("proposal_discount_invalid");
  });
});
