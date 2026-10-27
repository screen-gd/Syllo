import { describe, expect, it } from "vitest";
import { pickVideoFirst } from "@/lib/scout/discovery/combine";
import type { DiscoveredResource } from "@/lib/scout/discovery";

function video(id: string): DiscoveredResource {
    return {
        kind: "video",
        source: "test",
        url: `https://youtu.be/${id.padEnd(11, "x")}`,
        title: `Video ${id}`,
    };
}

function web(id: string): DiscoveredResource {
    return {
        kind: "article",
        source: "test",
        url: `https://blog.example.com/${id}`,
        title: `Article ${id}`,
    };
}

describe("pickVideoFirst", () => {
    it("puts videos first and caps web picks at a quarter when videos are plentiful", () => {
        const picked = pickVideoFirst({
            videos: [video("a"), video("b"), video("c"), video("d")],
            web: [web("w1"), web("w2"), web("w3"), web("w4"), web("w5")],
            limit: 8,
        });
        expect(picked.map((item) => item.kind)).toEqual([
            "video",
            "video",
            "video",
            "video",
            "article",
            "article",
        ]);
    });

    it("lets web fill the remaining slots when fewer than three videos exist", () => {
        const picked = pickVideoFirst({
            videos: [video("a"), video("b")],
            web: [web("w1"), web("w2"), web("w3"), web("w4")],
            limit: 5,
        });
        expect(picked.map((item) => item.title)).toEqual([
            "Video a",
            "Video b",
            "Article w1",
            "Article w2",
            "Article w3",
        ]);
    });

    it("keeps at least one web slot when videos hit the cap", () => {
        const picked = pickVideoFirst({
            videos: [video("a"), video("b"), video("c")],
            web: [web("w1"), web("w2")],
            limit: 4,
        });
        expect(picked).toHaveLength(4);
        expect(picked.at(-1)?.kind).toBe("article");
    });

    it("dedupes across youtube url shapes and cross-pool duplicates", () => {
        const picked = pickVideoFirst({
            videos: [
                { ...video("dup"), url: "https://www.youtube.com/watch?v=dupxxxxxxxy&utm_source=x" },
                { ...video("dup"), url: "https://youtu.be/dupxxxxxxxy" },
                video("b"),
            ],
            web: [{ ...web("same"), url: "https://youtu.be/dupxxxxxxxy" }, web("w2")],
            limit: 6,
        });
        expect(picked).toHaveLength(3);
        expect(picked.filter((item) => item.kind === "video")).toHaveLength(2);
        expect(picked.at(-1)?.title).toBe("Article w2");
    });
});
