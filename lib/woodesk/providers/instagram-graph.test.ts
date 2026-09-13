import { describe, expect, it, vi } from "vitest";

import { publishInstagramCarousel, publishInstagramImage, publishInstagramReel, publishInstagramStory } from "./instagram-graph";

describe("Instagram Graph provider", () => {
  it("creates and publishes an image container", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "media-1" }), { status: 200 }));
    await expect(publishInstagramImage({ accessToken: "secret", instagramUserId: "ig-1", caption: "Olá", imageUrl: "https://cdn.example/image.jpg", fetchImpl })).resolves.toEqual({ containerId: "container-1", mediaId: "media-1", provider: "meta_instagram_graph" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects non-HTTPS media URLs", async () => {
    await expect(publishInstagramImage({ accessToken: "secret", instagramUserId: "ig-1", caption: "Olá", imageUrl: "http://cdn.example/image.jpg", fetchImpl: vi.fn() })).rejects.toThrow("instagram_image_https_required");
  });

  it("publishes a carousel through child containers and a parent container", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "media-1" }), { status: 200 }));
    await expect(publishInstagramCarousel({ accessToken: "secret", instagramUserId: "ig-1", caption: "Carrossel", imageUrls: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"], fetchImpl })).resolves.toEqual({ containerId: "container-1", mediaId: "media-1", provider: "meta_instagram_graph" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toContain('"is_carousel_item":true');
    expect(fetchImpl.mock.calls[2]?.[1]?.body).toContain('"media_type":"CAROUSEL"');
  });

  it("publishes an image story", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "story-container" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "story-media" }), { status: 200 }));
    await expect(publishInstagramStory({ accessToken: "secret", instagramUserId: "ig-1", caption: "Story", imageUrl: "https://cdn.example/story.jpg", fetchImpl })).resolves.toMatchObject({ mediaId: "story-media" });
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toContain('"media_type":"STORIES"');
  });

  it("waits for a reel container to finish before publishing", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "reel-container" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "reel-media" }), { status: 200 }));
    await expect(publishInstagramReel({ accessToken: "secret", instagramUserId: "ig-1", caption: "Reel", videoUrl: "https://cdn.example/reel.mp4", fetchImpl, waitImpl: async () => undefined })).resolves.toMatchObject({ mediaId: "reel-media" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toContain('"media_type":"REELS"');
  });
});
