import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { enqueueJob } from "@/lib/agent-engine/queue/queue";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_google_business_sync" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "google_business").maybeSingle();
  if (flagError) return fail("internal_error", flagError.message, 500, { requestId });
  if (!flag?.enabled) return fail("feature_disabled", "Google Business não está habilitado para esta organização.", 403, { requestId });
  const { data: location, error: locationError } = await supabase.from("google_business_locations").select("id, status").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (locationError) return fail("internal_error", locationError.message, 500, { requestId });
  if (!location || location.status === "paused") return fail("not_found", "Local do Google Business não encontrado ou pausado.", 404, { requestId });
  try {
    const { job, deduped } = await enqueueJob(getRequestPool(), authz.org.orgId, { kind: "google_business_sync", payload: { location_id: location.id }, maxAttempts: 3 });
    return ok({ location_id: location.id, job_id: job.id, deduped }, { status: 202, requestId });
  } catch {
    return fail("service_unavailable", "Não foi possível enfileirar a sincronização.", 503, { requestId });
  }
}
