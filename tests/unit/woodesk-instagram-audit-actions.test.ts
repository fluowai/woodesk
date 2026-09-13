import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "@/lib/audit/actions";

describe("auditoria do Instagram Studio", () => {
  it("declara conexão e desconexão no vocabulário oficial", () => {
    expect(AUDIT_ACTIONS).toContain("woodesk.instagram_connected");
    expect(AUDIT_ACTIONS).toContain("woodesk.instagram_disconnected");
  });

  it("declara operações administrativas de feature flags", () => {
    expect(AUDIT_ACTIONS).toContain("platform_admin.woodesk_flags_listed");
    expect(AUDIT_ACTIONS).toContain("platform_admin.woodesk_flag_updated");
  });
});
