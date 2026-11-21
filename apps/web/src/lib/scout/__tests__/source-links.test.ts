import { describe, expect, it, vi } from "vitest";
import { selectLinkVideos } from "@/lib/scout/discovery/from-links";
import type { DiscoveredResource } from "@/lib/scout/discovery";
import { parseSourceLink, parseSourceLinks } from "@/lib/scout/source-links";

const VIDEO_ID = "dQw4w9WgXcQ";
const CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";

function video(id: string, title = `Video ${id}`): DiscoveredResource {
    return {
        kind: "video",
        source: "test",
        externalId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title,
    };
}

describe("parseSourceLink", () => {
    it("parses single video links", () => {
        expect(parseSourceLink(`https://youtu.be/${VIDEO_ID}`)).toEqual({ kind: "video", videoId: VIDEO_ID });
        expect(parseSourceLink(`https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLxyz`)).toEqual({ kind: "video", videoId: VIDEO_ID });
        expect(parseSourceLink(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toEqual({ kind: "video", videoId: VIDEO_ID });
        expect(parseSourceLink(`https://www.youtube.com/live/${VIDEO_ID}`)).toEqual({ kind: "video", videoId: VIDEO_ID });
    });

    it("parses playlist links", () => {
        expect(parseSourceLink("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf")).toEqual({
            kind: "playlist",
            playlistId: "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
        });
    });

    it("parses channel links and bare handles", () => {
        expect(parseSourceLink(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toEqual({ kind: "channel", value: CHANNEL_ID });
        expect(parseSourceLink("https://www.youtube.com/@t3dotgg/videos")).toEqual({ kind: "channel", value: "@t3dotgg" });
        expect(parseSourceLink("@t3dotgg")).toEqual({ kind: "channel", value: "@t3dotgg" });
        expect(parseSourceLink(CHANNEL_ID)).toEqual({ kind: "channel", value: CHANNEL_ID });
        expect(parseSourceLink("https://www.youtube.com/c/somechannel")).toEqual({
            kind: "channel",
            value: "https://www.youtube.com/c/somechannel",
        });
    });

    it("rejects non-YouTube links and plain words", () => {
        expect(parseSourceLink("https://vimeo.com/123")).toBeNull();
        expect(parseSourceLink("t3dotgg")).toBeNull();
        expect(parseSourceLink("")).toBeNull();
    });
});

describe("parseSourceLinks", () => {
    it("drops blank lines, collapses duplicates and reports bad lines", () => {
        const text = [
            "",
            `   https://youtu.be/${VIDEO_ID}   `,
            `https://www.youtube.com/watch?v=${VIDEO_ID}`,
            "not a link",
            "",
            "@t3dotgg",
        ].join("\n");

        const parsed = parseSourceLinks(text);
        expect(parsed.links).toEqual([
            { kind: "video", videoId: VIDEO_ID },
            { kind: "channel", value: "@t3dotgg" },
        ]);
        expect(parsed.invalid).toEqual(["not a link"]);
    });
});

describe("selectLinkVideos", () => {
    it("keeps pinned first and appends the pool in source order without ranking when it fits", async () => {
        const pinned = [video("pinned-one1")];
        const pool = [video("pool-video1"), video("pool-video2")];
        const rank = vi.fn(async (items: DiscoveredResource[]) => items);

        const selected = await selectLinkVideos({ pinned, pool, limit: 5, rank });

        expect(selected.map((item) => item.externalId)).toEqual(["pinned-one1", "pool-video1", "pool-video2"]);
        expect(rank).not.toHaveBeenCalled();
    });

    it("ranks the pool only for the leftover slots when it overflows", async () => {
        const pinned = [video("pinned-one1")];
        const pool = ["a", "b", "c", "d", "e"].map((id) => video(`pool-${id}-id`));
        const rank = vi.fn(async (items: DiscoveredResource[], slots: number) => items.slice(0, slots));

        const selected = await selectLinkVideos({ pinned, pool, limit: 3, rank });

        expect(rank).toHaveBeenCalledWith(pool, 2);
        expect(selected).toHaveLength(3);
        expect(selected.map((item) => item.externalId)).toEqual(["pinned-one1", "pool-a-id", "pool-b-id"]);
    });

    it("ignores picks that are not in the pool or duplicate a pinned video", async () => {
        const pinned = [video("pinned-one1")];
        const pool = [video("pool-aaaaaa1"), video("pool-bbbbb2"), video("pool-ccccc3")];
        const foreign = video("foreign-01");
        const rank = vi.fn(async () => [foreign, pinned[0], pool[1]]);

        const selected = await selectLinkVideos({ pinned, pool, limit: 3, rank });

        expect(selected.map((item) => item.externalId)).toEqual(["pinned-one1", "pool-bbbbb2"]);
    });

    it("cuts pinned videos to the limit when they alone overflow", async () => {
        const pinned = [video("pinned-one1"), video("pinned-two2"), video("pinned-three")];
        const rank = vi.fn(async (items: DiscoveredResource[]) => items);

        const selected = await selectLinkVideos({ pinned, pool: [], limit: 2, rank });

        expect(selected.map((item) => item.externalId)).toEqual(["pinned-one1", "pinned-two2"]);
        expect(rank).not.toHaveBeenCalled();
    });
});
