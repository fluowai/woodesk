export type MarketingChannel = "instagram" | "whatsapp" | "email" | "sms" | "voice";
export type MarketingContentType = "post" | "story" | "reel" | "carousel" | "caption" | "script" | "email";

export interface ContentBrief {
  organizationId: string;
  channel: MarketingChannel;
  contentType: MarketingContentType;
  businessContext: string;
  audience: string;
  tone: string;
  objective: string;
}

export interface ContentDraft {
  title?: string;
  body: string;
  context: ContentBrief;
  requiresApproval: true;
}

export function createContentDraft(brief: ContentBrief, body: string, title?: string): ContentDraft {
  if (brief.organizationId.trim() === "") throw new Error("content_organization_required");
  if (body.trim() === "") throw new Error("content_body_required");
  return { ...(title ? { title: title.trim() } : {}), body: body.trim(), context: brief, requiresApproval: true };
}
