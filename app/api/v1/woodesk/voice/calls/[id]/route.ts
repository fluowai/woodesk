import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "woodesk_voice" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: call, error: callError } = await supabase.from("voice_calls").select("id, contact_id, provider_id, direction, status, external_id, started_at, ended_at, duration_seconds, cost_cents, metadata, created_at, updated_at").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (callError) return fail("internal_error", callError.message, 500, { requestId });
  if (!call) return fail("not_found", "Ligação não encontrada.", 404, { requestId });
  const { data: transcripts, error: transcriptError } = await supabase.from("voice_transcripts").select("id, transcript, language, provider_id, created_at").eq("organization_id", authz.org.orgId).eq("call_id", id).order("created_at", { ascending: true });
  if (transcriptError) return fail("internal_error", transcriptError.message, 500, { requestId });
  return ok({ call, transcripts: transcripts ?? [] }, { requestId });
}
