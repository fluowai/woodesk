export type InstagramDirectMessageInput = {
  accessToken: string;
  instagramBusinessAccountId: string;
  recipientInstagramId: string;
  text: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
};

export async function sendInstagramDirectMessage(input: InstagramDirectMessageInput): Promise<{ externalId: string }> {
  const text = input.text.trim();
  if (!input.accessToken.trim() || !input.instagramBusinessAccountId.trim() || !input.recipientInstagramId.trim()) throw new Error("instagram_messaging_credentials_required");
  if (!text || text.length > 1000) throw new Error("instagram_messaging_text_invalid");
  const fetchImpl = input.fetchImpl ?? fetch;
  const graphVersion = input.graphVersion ?? "v22.0";
  const response = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.instagramBusinessAccountId)}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: input.recipientInstagramId }, message: { text } }),
  });
  const body = (await response.json().catch(() => ({}))) as { message_id?: unknown; error?: { code?: unknown } };
  if (!response.ok || typeof body.message_id !== "string" || !body.message_id) throw new Error(`instagram_messaging_failed:${response.status}:${typeof body.error?.code === "string" ? body.error.code : "unknown"}`);
  return { externalId: body.message_id };
}
