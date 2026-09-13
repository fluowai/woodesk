export interface PlanEntitlement {
  enabled: boolean;
  monthlyLimit: number | null;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason: "enabled" | "disabled" | "limit_reached" | "missing_plan";
}

export function decideEntitlement(
  entitlement: PlanEntitlement | null,
  usedThisMonth: number,
): EntitlementDecision {
  if (!entitlement) return { allowed: false, reason: "missing_plan" };
  if (!entitlement.enabled) return { allowed: false, reason: "disabled" };
  if (!Number.isFinite(usedThisMonth) || usedThisMonth < 0) {
    return { allowed: false, reason: "limit_reached" };
  }
  if (entitlement.monthlyLimit !== null && usedThisMonth >= entitlement.monthlyLimit) {
    return { allowed: false, reason: "limit_reached" };
  }
  return { allowed: true, reason: "enabled" };
}
