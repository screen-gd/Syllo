import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    channelVideosPageUrl,
    extractEmbeddedJson,
    lastContinuationToken,
    listLinkVideos,
    parseClockDuration,
    relativeTimeToIso,
} from "@/lib/scout/discovery/youtube";

const CHANNEL_ID = "UCbRP3c757lWg9M-U7TyEkXA";

function videoRenderer(id: string, title: string, length: string, published: string) {
    return {
        videoRenderer: {
            videoId: id,
            title: { runs: [{ text: title }] },
            lengthText: { simpleText: length },
            publishedTimeText: { simpleText: published },
            ownerText: { runs: [{ text: "Design Channel" }] },
        },
    };
}

function channelPageHtml(videoCount: number, continuationToken: string | null) {
    const items: unknown[] = [];
    for (let index = 0; index < videoCount; index++) {
        const id = `video${String(index).padStart(3, "0")}`;
        items.push({ richItemRenderer: { content: videoRenderer(id, `Episode ${index}`, "12:34", "3 days ago") } });
    }
    items.push({
        richItemRenderer: {
            content: { reelItemRenderer: { videoId: "short001", headline: { runs: [{ text: "A short" }] } } },
        },
    });
    if (continuationToken) {
        items.push({
            continuationItemRenderer: {
                continuationEndpoint: { continuationCommand: { token: continuationToken } },
            },
        });
    }

    const initialData = {
        contents: {
            twoColumnBrowseResultsRenderer: {
                tabs: [{ tabRenderer: { content: { richGridRenderer: { contents: items } } } }],
            },
        },
    };

    return [
        `<html><head><link rel="canonical" href="https://www.youtube.com/channel/${CHANNEL_ID}"></head><body>`,
        `<script>var ytInitialData = ${JSON.stringify(initialData)};</script>`,
        `<script>ytcfg.set({"INNERTUBE_API_KEY":"TEST_KEY","INNERTUBE_CLIENT_NAME":"WEB","INNERTUBE_CLIENT_VERSION":"9.9","VISITOR_DATA":"visitor"});</script>`,
        `</body></html>`,
    ].join("\n");
}

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>feedvideo001</yt:videoId>
    <title>Feed video</title>
    <published>2026-10-01T09:00:00+00:00</published>
    <author><name>Design Channel</name></author>
  </entry>
</feed>`;

function stubbedFetch(handlers: Array<{ match: (url: string, init?: RequestInit) => boolean; body: string | (() => string); status?: number }>) {
    const calls: string[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: unknown, init?: RequestInit) => {
            const url = typeof input === "string" ? input : (input as { url: string }).url;
            calls.push(url);
            const handler = handlers.find((entry) => entry.match(url, init));
            if (!handler) return new Response("not found", { status: 404 });
            const body = typeof handler.body === "function" ? handler.body() : handler.body;
            return new Response(body, { status: handler.status ?? 200 });
        }),
    );
    return calls;
}

describe("channelVideosPageUrl", () => {
    it("builds /videos URLs for handles, ids and legacy channel paths", () => {
        expect(channelVideosPageUrl("@mattpocockuk")).toBe("https://www.youtube.com/@mattpocockuk/videos");
        expect(channelVideosPageUrl("mattpocockuk")).toBe("https://www.youtube.com/@mattpocockuk/videos");
        expect(channelVideosPageUrl(`https://www.youtube.com/@mattpocockuk`)).toBe(
            "https://www.youtube.com/@mattpocockuk/videos",
        );
        expect(channelVideosPageUrl(CHANNEL_ID)).toBe(`https://www.youtube.com/channel/${CHANNEL_ID}/videos`);
        expect(channelVideosPageUrl(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toBe(
            `https://www.youtube.com/channel/${CHANNEL_ID}/videos`,
        );
        expect(channelVideosPageUrl("https://www.youtube.com/c/somename")).toBe(
            "https://www.youtube.com/c/somename/videos",
        );
        expect(channelVideosPageUrl("https://www.youtube.com/user/somename")).toBe(
            "https://www.youtube.com/user/somename/videos",
        );
        expect(channelVideosPageUrl("not a channel")).toBeNull();
    });
});

describe("extractEmbeddedJson", () => {
    it("parses an assignment even when strings contain braces and semicolons", () => {
        const html = `<script>var ytInitialData = {"a":{"b":"}; tricky ;"},"junk":1};</script>`;
        expect(extractEmbeddedJson(html, "ytInitialData")).toEqual({ a: { b: "}; tricky ;" }, junk: 1 });
    });

    it("returns null when the marker or object is missing", () => {
        expect(extractEmbeddedJson("<html></html>", "ytInitialData")).toBeNull();
        expect(extractEmbeddedJson("ytInitialData = nope", "ytInitialData")).toBeNull();
    });
});

describe("parseClockDuration", () => {
    it("reads mm:ss and hh:mm:ss grid labels", () => {
        expect(parseClockDuration("12:34")).toBe(754);
        expect(parseClockDuration("1:02:34")).toBe(3754);
        expect(parseClockDuration("0:42")).toBe(42);
        expect(parseClockDuration("live")).toBeNull();
        expect(parseClockDuration("5")).toBeNull();
    });
});

describe("relativeTimeToIso", () => {
    it("approximates YouTube's relative dates and ignores other text", () => {
        const threeDaysAgo = relativeTimeToIso("3 days ago");
        expect(threeDaysAgo).not.toBeNull();
        const ageMs = Date.now() - new Date(threeDaysAgo as string).getTime();
        expect(ageMs).toBeGreaterThan(2.5 * 86_400_000);
        expect(ageMs).toBeLessThan(3.5 * 86_400_000);

        expect(relativeTimeToIso("Streamed 2 weeks ago")).not.toBeNull();
        expect(relativeTimeToIso("Premiered")).toBeNull();
        expect(relativeTimeToIso("hello")).toBeNull();
    });
});

describe("lastContinuationToken", () => {
    it("takes the last continuationItemRenderer token in a flat payload", () => {
        const payload = {
            a: { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "first" } } } },
            b: [{ nested: { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "last" } } } } }],
        };
        expect(lastContinuationToken(payload)).toBe("last");
        expect(lastContinuationToken({})).toBeNull();
    });

    it("prefers the token inside the video grid over later non-grid tokens", () => {
        const page = {
            grid: {
                richGridRenderer: {
                    contents: [
                        { richItemRenderer: {} },
                        { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "grid" } } } },
                    ],
                },
            },
            other: { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: "reload" } } } },
        };
        expect(lastContinuationToken(page)).toBe("grid");
    });
});

describe("listLinkVideos keyless channel listing", () => {
    beforeEach(() => {
        delete process.env.YOUTUBE_API_KEY;
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.YOUTUBE_API_KEY;
    });

    it("scrapes the channel /videos page and follows continuations past the 15-feed cap", async () => {
        const continuationPayload = {
            onResponseReceivedActions: [
                {
                    appendContinuationItemsAction: {
                        continuationItems: Array.from({ length: 5 }, (_, index) => ({
                            richItemRenderer: {
                                content: videoRenderer(`older${index}`, `Older ${index}`, "20:00", "2 months ago"),
                            },
                        })),
                    },
                },
            ],
        };

        stubbedFetch([
            { match: (url) => url.endsWith("/@design/videos"), body: channelPageHtml(30, "TOKEN_1") },
            { match: (url) => url.includes("youtubei/v1/browse"), body: JSON.stringify(continuationPayload) },
            { match: (url) => url.includes("feeds/videos.xml"), body: feedXml },
        ]);

        const result = await listLinkVideos({ kind: "channel", value: "@design" });

        expect(result.feedOnly).toBe(false);
        expect(result.videos).toHaveLength(35);
        expect(result.videos[0]).toMatchObject({
            kind: "video",
            externalId: "video000",
            title: "Episode 0",
            durationSeconds: 754,
        });
        expect(result.videos.some((video) => video.externalId === "short001")).toBe(false);
        expect(result.videos.some((video) => video.externalId === "feedvideo001")).toBe(false);
    });

    it("falls back to the 15-item feed when the page scrape fails", async () => {
        stubbedFetch([
            { match: (url) => url.endsWith("/@design/videos"), body: "", status: 404 },
            {
                match: (url) => url.endsWith("/@design"),
                body: `<html><script>{"externalId":"${CHANNEL_ID}"}</script></html>`,
            },
            { match: (url) => url.includes("feeds/videos.xml"), body: feedXml },
        ]);

        const result = await listLinkVideos({ kind: "channel", value: "@design" });

        expect(result.feedOnly).toBe(true);
        expect(result.videos).toHaveLength(1);
        expect(result.videos[0].externalId).toBe("feedvideo001");
    });

    it("reuses the channel id scraped from the page instead of resolving again", async () => {
        const calls = stubbedFetch([
            // Page loads, exposes the channel id, but has no ytInitialData.
            {
                match: (url) => url.endsWith("/@design/videos"),
                body: `<html><script>{"externalId":"${CHANNEL_ID}"}</script></html>`,
            },
            { match: (url) => url.includes("feeds/videos.xml"), body: feedXml },
        ]);

        const result = await listLinkVideos({ kind: "channel", value: "@design" });

        expect(result.feedOnly).toBe(true);
        expect(result.videos).toHaveLength(1);
        expect(calls.some((url) => url.endsWith("/@design"))).toBe(false);
    });
});
