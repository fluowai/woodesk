import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_agent_tasks" });
  if (!authz.ok) return authz.response;
  const db = (await createClient()) as SupabaseClient;
  const taskTable: string = "agent_tasks";
  const { data: flag, error: flagError } = await db.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "agent_orchestrator").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Orquestração de agentes não está habilitada para esta organização.", 403, { requestId });
  const status = request.nextUrl.searchParams.get("status");
  let query = db.from(taskTable).select("id, role, capability, status, requires_human_approval, error_code, result, created_at, started_at, finished_at, updated_at").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ tasks: data ?? [] }, { requestId });
}
