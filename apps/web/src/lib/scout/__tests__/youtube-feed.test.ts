import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoutError } from "@/lib/scout/llm";
import { channelIdFromHtml, listLinkVideos, parseYouTubeFeed } from "@/lib/scout/discovery/youtube";
import { SOURCE_COPY } from "@/lib/scout/source-copy";

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Channel</title>
  <entry>
    <id>yt:video:aaaaaaaaaaa</id>
    <yt:videoId>aaaaaaaaaaa</yt:videoId>
    <title>Design tokens from scratch</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=aaaaaaaaaaa"/>
    <published>2026-10-01T09:00:00+00:00</published>
    <author><name>Design Channel</name></author>
    <media:thumbnail url="https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg" width="480" height="360"/>
    <media:description><![CDATA[00:00 Intro & setup
12:30 Tokens in practice]]></media:description>
  </entry>
  <entry>
    <yt:videoId>bbbbbbbbbbb</yt:videoId>
    <title>Type &amp; scale</title>
    <published>2026-09-24T09:00:00+00:00</published>
    <author><name>Design Channel</name></author>
    <media:description>No chapters here</media:description>
  </entry>
  <entry>
    <title>Broken entry without a video id</title>
  </entry>
</feed>`;

describe("YouTube channel RSS", () => {
    it("parses entries, CDATA and escaped titles", () => {
        const items = parseYouTubeFeed(feed);

        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({
            kind: "video",
            source: "youtube-rss",
            externalId: "aaaaaaaaaaa",
            url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
            title: "Design tokens from scratch",
            creator: "Design Channel",
            thumbnailUrl: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
        });
        expect(items[0].description).toContain("12:30 Tokens in practice");
        expect(items[1].title).toBe("Type & scale");
        expect(items[1].thumbnailUrl).toBeNull();
    });

    it("returns an empty list for feeds it cannot read", () => {
        expect(parseYouTubeFeed("")).toEqual([]);
        expect(parseYouTubeFeed("<feed></feed>")).toEqual([]);
    });
});

describe("channelIdFromHtml", () => {
    const OWNER = "UCbRP3c757lWg9M-U7TyEkXA";
    const DECOY = "UCtuO2h6OwDueF7h3p8DYYjQ";

    it("prefers the canonical link over channelId mentions elsewhere on the page", () => {
        const html = [
            `<script>{"channelId":"${DECOY}"}</script>`,
            `<link rel="canonical" href="https://www.youtube.com/channel/${OWNER}">`,
            `<script>{"externalId":"${DECOY}"}</script>`,
        ].join("\n");
        expect(channelIdFromHtml(html)).toBe(OWNER);
    });

    it("falls back to externalId when there is no canonical link", () => {
        const html = `{"channelId":"${DECOY}","externalId":"${OWNER}"}`;
        expect(channelIdFromHtml(html)).toBe(OWNER);
    });

    it("falls back to the feed URL, then the legacy channelId match", () => {
        expect(channelIdFromHtml(`href="https://www.youtube.com/feeds/videos.xml?channel_id=${OWNER}"`)).toBe(OWNER);
        expect(channelIdFromHtml(`{"channelId":"${DECOY}"}`)).toBe(DECOY);
        expect(channelIdFromHtml(`<a href="/channel/${OWNER}">`)).toBe(OWNER);
    });

    it("returns null when no channel id is present", () => {
        expect(channelIdFromHtml("<html><body>no ids here</body></html>")).toBeNull();
    });
});

describe("listLinkVideos with a rejected YouTube key", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.YOUTUBE_API_KEY;
    });

    it("turns an invalid API key into a ScoutError config failure", async () => {
        process.env.YOUTUBE_API_KEY = "not-a-real-key";
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }), {
                    status: 400,
                }),
            ),
        );

        let caught: unknown;
        try {
            await listLinkVideos({ kind: "video", videoId: "dQw4w9WgXcQ" });
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(ScoutError);
        if (caught instanceof ScoutError) {
            expect(caught.code).toBe("config");
            expect(caught.message).toBe(SOURCE_COPY.badYouTubeKey);
        }
    });
});
