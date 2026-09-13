import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { authenticatedSessionId } from "@/lib/impersonate/support";
import { env } from "@/lib/env";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { NOME_DO_VINCULO, VALIDADE_DO_VINCULO_S, assinarVinculo } from "@/lib/agenda/google/vinculo";
import { issueInstagramState, instagramAuthorizeUrl, verifyInstagramState } from "@/lib/woodesk/instagram/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "woodesk_instagram_connect" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("enabled").eq("organization_id", authz.org.orgId).eq("key", "instagram_studio").maybeSingle();
  if (flagError || !flag?.enabled) return NextResponse.redirect(new URL(`/app/woodesk?instagram=${flagError ? "unavailable" : "disabled"}`, request.url));
  const state = issueInstagramState(authz.org.orgId, { userId: authz.user.id, authSessionId: await authenticatedSessionId() });
  const redirectUri = new URL("/api/v1/woodesk/instagram/callback", request.url).toString();
  const location = instagramAuthorizeUrl({ state, redirectUri });
  const verifiedState = verifyInstagramState(state);
  if (!verifiedState) return NextResponse.redirect(new URL("/app/woodesk?instagram=invalid_state", request.url));
  const response = NextResponse.redirect(location);
  response.cookies.set(NOME_DO_VINCULO, assinarVinculo(verifiedState.nonce, env.INTERNAL_SECRET), { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/api/v1/woodesk/instagram/callback", maxAge: VALIDADE_DO_VINCULO_S });
  return response;
}
