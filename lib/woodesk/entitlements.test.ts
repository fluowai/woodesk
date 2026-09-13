import { describe, expect, it } from "vitest";
import { decideEntitlement } from "./entitlements";

describe("Woodesk entitlements", () => {
  it("fails closed without a plan entitlement", () => {
    expect(decideEntitlement(null, 0)).toEqual({ allowed: false, reason: "missing_plan" });
  });

  it("allows usage below a configured limit", () => {
    expect(decideEntitlement({ enabled: true, monthlyLimit: 10 }, 9)).toEqual({ allowed: true, reason: "enabled" });
  });

  it("blocks disabled and exhausted capabilities", () => {
    expect(decideEntitlement({ enabled: false, monthlyLimit: null }, 0).allowed).toBe(false);
    expect(decideEntitlement({ enabled: true, monthlyLimit: 10 }, 10).reason).toBe("limit_reached");
  });
});
