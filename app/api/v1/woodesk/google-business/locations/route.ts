import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_google_business_locations" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "google_business").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Google Business não está habilitado para esta organização.", 403, { requestId });
  const { data, error } = await supabase.from("google_business_locations").select("id, resource_name, title, address, metadata, status, last_synced_at, created_at").eq("organization_id", authz.org.orgId).order("title", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ locations: data ?? [] }, { requestId });
}
