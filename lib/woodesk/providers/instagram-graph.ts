export interface InstagramPublishRequest {
  accessToken: string;
  instagramUserId: string;
  caption: string;
  imageUrl: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
}

export interface InstagramPublishResult {
  containerId: string;
  mediaId: string;
  provider: "meta_instagram_graph";
}

export interface InstagramCarouselRequest {
  accessToken: string;
  instagramUserId: string;
  caption: string;
  imageUrls: string[];
  graphVersion?: string;
  fetchImpl?: typeof fetch;
}

export type InstagramStoryRequest = InstagramPublishRequest;

export interface InstagramReelRequest {
  accessToken: string;
  instagramUserId: string;
  caption: string;
  videoUrl: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
  waitImpl?: (ms: number) => Promise<void>;
  maxPolls?: number;
}

type GraphResponse = { id?: string; error?: { message?: string; code?: number } };

function mediaUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("instagram_image_https_required");
  return parsed;
}

export async function publishInstagramImage(request: InstagramPublishRequest): Promise<InstagramPublishResult> {
  if (!request.accessToken.trim() || !request.instagramUserId.trim()) throw new Error("instagram_credentials_required");
  const image = mediaUrl(request.imageUrl).toString();
  const version = request.graphVersion ?? "v22.0";
  const fetcher = request.fetchImpl ?? fetch;
  const container = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: image, caption: request.caption.trim() }),
  });
  const containerBody = (await container.json()) as GraphResponse;
  if (!container.ok || !containerBody.id) throw new Error(`instagram_container_failed:${containerBody.error?.code ?? container.status}`);
  const published = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media_publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerBody.id }),
  });
  const publishedBody = (await published.json()) as GraphResponse;
  if (!published.ok || !publishedBody.id) throw new Error(`instagram_publish_failed:${publishedBody.error?.code ?? published.status}`);
  return { containerId: containerBody.id, mediaId: publishedBody.id, provider: "meta_instagram_graph" };
}

export async function publishInstagramCarousel(request: InstagramCarouselRequest): Promise<InstagramPublishResult> {
  if (!request.accessToken.trim() || !request.instagramUserId.trim()) throw new Error("instagram_credentials_required");
  if (request.imageUrls.length < 2 || request.imageUrls.length > 10) throw new Error("instagram_carousel_requires_2_to_10_images");
  const version = request.graphVersion ?? "v22.0";
  const fetcher = request.fetchImpl ?? fetch;
  const urls = request.imageUrls.map((value) => mediaUrl(value).toString());
  const children: string[] = [];
  for (const url of urls) {
    const response = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ image_url: url, is_carousel_item: true }) });
    const body = (await response.json()) as GraphResponse;
    if (!response.ok || !body.id) throw new Error(`instagram_carousel_child_failed:${body.error?.code ?? response.status}`);
    children.push(body.id);
  }
  const container = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "CAROUSEL", children: children.join(","), caption: request.caption.trim() }) });
  const containerBody = (await container.json()) as GraphResponse;
  if (!container.ok || !containerBody.id) throw new Error(`instagram_carousel_container_failed:${containerBody.error?.code ?? container.status}`);
  const published = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media_publish`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: containerBody.id }) });
  const publishedBody = (await published.json()) as GraphResponse;
  if (!published.ok || !publishedBody.id) throw new Error(`instagram_publish_failed:${publishedBody.error?.code ?? published.status}`);
  return { containerId: containerBody.id, mediaId: publishedBody.id, provider: "meta_instagram_graph" };
}

export async function publishInstagramStory(request: InstagramStoryRequest): Promise<InstagramPublishResult> {
  if (!request.accessToken.trim() || !request.instagramUserId.trim()) throw new Error("instagram_credentials_required");
  const version = request.graphVersion ?? "v22.0";
  const fetcher = request.fetchImpl ?? fetch;
  const response = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ image_url: mediaUrl(request.imageUrl).toString(), media_type: "STORIES" }) });
  const body = (await response.json()) as GraphResponse;
  if (!response.ok || !body.id) throw new Error(`instagram_story_container_failed:${body.error?.code ?? response.status}`);
  const published = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media_publish`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: body.id }) });
  const publishedBody = (await published.json()) as GraphResponse;
  if (!published.ok || !publishedBody.id) throw new Error(`instagram_publish_failed:${publishedBody.error?.code ?? published.status}`);
  return { containerId: body.id, mediaId: publishedBody.id, provider: "meta_instagram_graph" };
}

export async function publishInstagramReel(request: InstagramReelRequest): Promise<InstagramPublishResult> {
  if (!request.accessToken.trim() || !request.instagramUserId.trim()) throw new Error("instagram_credentials_required");
  const version = request.graphVersion ?? "v22.0";
  const fetcher = request.fetchImpl ?? fetch;
  const wait = request.waitImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const createResponse = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ media_type: "REELS", video_url: mediaUrl(request.videoUrl).toString(), caption: request.caption.trim() }) });
  const created = (await createResponse.json()) as GraphResponse;
  if (!createResponse.ok || !created.id) throw new Error(`instagram_reel_container_failed:${created.error?.code ?? createResponse.status}`);
  const maxPolls = request.maxPolls ?? 30;
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const statusResponse = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(created.id)}?fields=status_code`, { headers: { Authorization: `Bearer ${request.accessToken}` } });
    const status = (await statusResponse.json()) as GraphResponse & { status_code?: string };
    if (!statusResponse.ok) throw new Error(`instagram_reel_status_failed:${status.error?.code ?? statusResponse.status}`);
    if (status.status_code === "ERROR") throw new Error("instagram_reel_processing_failed");
    if (status.status_code === "FINISHED") break;
    if (attempt === maxPolls - 1) throw new Error("instagram_reel_processing_timeout");
    await wait(2000);
  }
  const published = await fetcher(`https://graph.facebook.com/${version}/${encodeURIComponent(request.instagramUserId)}/media_publish`, { method: "POST", headers: { Authorization: `Bearer ${request.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: created.id }) });
  const publishedBody = (await published.json()) as GraphResponse;
  if (!published.ok || !publishedBody.id) throw new Error(`instagram_publish_failed:${publishedBody.error?.code ?? published.status}`);
  return { containerId: created.id, mediaId: publishedBody.id, provider: "meta_instagram_graph" };
}
