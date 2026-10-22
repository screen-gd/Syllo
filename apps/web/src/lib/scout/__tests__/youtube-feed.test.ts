import { describe, expect, it } from "vitest";
import { parseYouTubeFeed } from "@/lib/scout/discovery/youtube";

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
