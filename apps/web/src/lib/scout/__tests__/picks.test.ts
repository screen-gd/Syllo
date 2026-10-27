import { describe, expect, it } from "vitest";
import { groupPicks } from "@/lib/scout/picks";
import type { ScoutResource } from "@/lib/scout/types";

function resource(
    id: string,
    kind: ScoutResource["kind"],
    level: ScoutResource["level"] = null,
): ScoutResource {
    return {
        id,
        kind,
        source: "test",
        url: `https://example.com/${id}`,
        title: `Resource ${id}`,
        level,
        keyPoints: [],
        skillTags: [],
        chapters: [],
        transcriptStatus: "ok",
        transcriptChars: 400,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
    };
}

describe("groupPicks", () => {
    it("groups by level, puts unsorted after advanced and reading last", () => {
        const groups = groupPicks([
            resource("adv", "video", "advanced"),
            resource("book", "book", "basics"),
            resource("base", "video", "basics"),
            resource("mid", "video", "intermediate"),
            resource("free", "article", null),
        ]);
        expect(groups.map((group) => group.level)).toEqual([
            "basics",
            "intermediate",
            "advanced",
            "unsorted",
            "reading",
        ]);
        expect(groups.at(-1)?.items[0].role).toBe("reading");
    });

    it("marks the first five videos core and the rest deeper", () => {
        const groups = groupPicks(
            ["v1", "v2", "v3", "v4", "v5", "v6"].map((id) =>
                resource(id, "video", "basics"),
            ),
        );
        const roles = groups[0].items.map((item) => item.role);
        expect(roles).toEqual(["core", "core", "core", "core", "core", "deeper"]);
    });

    it("caps core at three when a level has no videos", () => {
        const groups = groupPicks(
            ["a1", "a2", "a3", "a4"].map((id) => resource(id, "article", "intermediate")),
        );
        expect(groups[0].items.map((item) => item.role)).toEqual([
            "core",
            "core",
            "core",
            "deeper",
        ]);
    });

    it("treats unsorted picks like a level and omits empty groups", () => {
        const groups = groupPicks([resource("v1", "video", null), resource("b1", "book", null)]);
        expect(groups.map((group) => group.level)).toEqual(["unsorted", "reading"]);
        expect(groups[0].items[0].role).toBe("core");
    });
});
