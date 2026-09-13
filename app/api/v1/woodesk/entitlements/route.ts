import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_entitlements" });
  if (!authz.ok) return authz.response;
  const db = (await createClient()) as SupabaseClient;
  const organizationsTable: string = "organizations";
  const entitlementsTable: string = "plan_entitlements";
  const { data: organization, error: organizationError } = await db.from(organizationsTable).select("plan_id").eq("id", authz.org.orgId).maybeSingle();
  if (organizationError) return fail("internal_error", "Não foi possível carregar o plano da organização.", 500, { requestId });
  const planId = (organization as { plan_id?: string | null } | null)?.plan_id;
  if (!planId) return ok({ plan_id: null, entitlements: [] }, { requestId });
  const { data: entitlements, error } = await db.from(entitlementsTable).select("capability, enabled, monthly_limit, config").eq("plan_id", planId).order("capability", { ascending: true });
  if (error) return fail("internal_error", "Não foi possível carregar as capacidades do plano.", 500, { requestId });
  return ok({ plan_id: planId, entitlements: entitlements ?? [] }, { requestId });
}
