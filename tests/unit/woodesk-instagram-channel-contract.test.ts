import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato de canal Instagram no schema", () => {
  it("mantém migration, baseline e manifest alinhados", () => {
    const root = process.cwd();
    const sessionMigration = readFileSync(join(root, "supabase/migrations/20260913160000_0254_woodesk_instagram_channel_session.sql"), "utf8");
    const identityMigration = readFileSync(join(root, "supabase/migrations/20260913170000_0255_woodesk_instagram_identity.sql"), "utf8");
    const engineMigration = readFileSync(join(root, "supabase/migrations/20260913180000_0256_woodesk_instagram_engine.sql"), "utf8");
    const replyQueueMigration = readFileSync(join(root, "supabase/migrations/20260913190000_0257_woodesk_instagram_reply_queue.sql"), "utf8");
    const baseline = readFileSync(join(root, "supabase/baseline.sql"), "utf8");
    const manifest = readFileSync(join(root, "supabase/migrations/MANIFEST.md"), "utf8");

    expect(sessionMigration).toContain("instagram_graph");
    expect(sessionMigration).toContain("instagram_account_id");
    expect(identityMigration).toContain("instagram_identity");
    expect(engineMigration).toContain("INSTAGRAM_GRAPH");
    expect(replyQueueMigration).toContain("instagram_reply");
    expect(baseline).toContain("-- 0254:");
    expect(baseline).toContain("-- 0255:");
    expect(baseline).toContain("-- 0256:");
    expect(baseline).toContain("-- 0257:");
    expect(manifest).toContain("0254_woodesk_instagram_channel_session");
    expect(manifest).toContain("0255_woodesk_instagram_identity");
    expect(manifest).toContain("0256_woodesk_instagram_engine");
    expect(manifest).toContain("0257_woodesk_instagram_reply_queue");
  });
});
