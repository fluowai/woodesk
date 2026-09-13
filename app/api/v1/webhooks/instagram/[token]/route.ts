import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { ingestInstagramInbound } from "@/lib/woodesk/instagram/ingest";
import { parseInstagramWebhook, verifyInstagramWebhookSignature } from "@/lib/woodesk/instagram/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const verifyToken = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !challenge || !verifyToken || verifyToken !== (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "")) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createAdminClient();
  const { data: session, error } = await admin.from("channel_sessions").select("id").eq("webhook_path_token", token).eq("provider", "instagram_graph").is("archived_at", null).maybeSingle();
  if (error || !session) return new Response("not found", { status: 404 });
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { token } = await context.params;
  const rawBody = await request.text();
  if (!verifyInstagramWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? "")) {
    return fail("unauthorized", "invalid_signature", 401);
  }

  const admin = createAdminClient();
  const { data: rawSession, error: sessionError } = await admin
    .from("channel_sessions")
    .select("id, organization_id, instagram_account_id")
    .eq("webhook_path_token", token)
    .eq("provider", "instagram_graph")
    .is("archived_at", null)
    .maybeSingle();
  const session = rawSession as { id: string; organization_id: string; instagram_account_id: string | null } | null;
  if (sessionError || !session) return fail("not_found", "unknown webhook token", 404);
  if (!session.instagram_account_id) return fail("conflict", "instagram_session_not_bound", 409);

  let events: ReturnType<typeof parseInstagramWebhook>;
  try {
    events = parseInstagramWebhook(rawBody);
  } catch {
    return fail("invalid_request", "invalid_json", 400);
  }
  const outcomes: string[] = [];
  for (const event of events) {
    if (event.recipientId !== session.instagram_account_id) {
      outcomes.push("ignored_recipient");
      continue;
    }
    try {
      const result = await ingestInstagramInbound(getRequestPool(), {
        organizationId: session.organization_id,
        channelSessionId: session.id,
        event,
      });
      outcomes.push(result.status);
    } catch (error) {
      logger.error("[instagram.webhook] inbound ingestion failed", {
        provider: "instagram_graph",
        organization_id: session.organization_id,
        channel_session_id: session.id,
        error: error instanceof Error ? error.message.slice(0, 120) : "unknown_error",
      });
      outcomes.push("failed");
    }
  }
  return NextResponse.json({ received: events.length, outcomes }, { status: 200 });
}
