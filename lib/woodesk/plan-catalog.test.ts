import { describe, expect, it } from "vitest";
import { isWoodeskCapability, WOODESK_PLAN_CAPABILITIES, WOODESK_CAPABILITY_LABELS, isRegistryCapability } from "./plan-catalog";

describe("Woodesk plan catalog", () => {
  it("keeps every Growth OS capability labeled", () => {
    for (const capability of WOODESK_PLAN_CAPABILITIES) {
      expect(WOODESK_CAPABILITY_LABELS[capability]).toBeTruthy();
    }
  });

  it("rejects arbitrary entitlement capabilities at the application boundary", () => {
    expect(isWoodeskCapability("lead_search")).toBe(true);
    expect(isWoodeskCapability("unknown_internal_feature")).toBe(false);
    expect(isRegistryCapability("process_search")).toBe(true);
  });

  it("keeps every plan capability present in the provider registry", () => {
    for (const capability of WOODESK_PLAN_CAPABILITIES) {
      expect(isRegistryCapability(capability)).toBe(true);
    }
  });
});
