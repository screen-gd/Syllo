import { describe, expect, it } from "vitest";
import {
    chunkText,
    deepLink,
    formatTimestamp,
    normalizeForMatch,
    parseDescriptionChapters,
    parseIsoDuration,
    parseTimestamp,
    quoteAppearsIn,
} from "@/lib/scout/format";

describe("Scout timestamps", () => {
    it("parses minute and hour timestamps", () => {
        expect(parseTimestamp("0:00")).toBe(0);
        expect(parseTimestamp("1:23")).toBe(83);
        expect(parseTimestamp("01:02:03")).toBe(3723);
        expect(parseTimestamp("12:30")).toBe(750);
    });

    it("rejects malformed and out-of-range values", () => {
        expect(parseTimestamp("1:60")).toBeNull();
        expect(parseTimestamp("1:02:75")).toBeNull();
        expect(parseTimestamp("intro")).toBeNull();
        expect(parseTimestamp("")).toBeNull();
    });

    it("formats seconds without padding the leading unit", () => {
        expect(formatTimestamp(0)).toBe("0:00");
        expect(formatTimestamp(83)).toBe("1:23");
        expect(formatTimestamp(3723)).toBe("1:02:03");
        expect(formatTimestamp(-4)).toBe("0:00");
    });

    it("builds deep links only when there is an offset", () => {
        expect(deepLink("abc12345678")).toBe("https://youtu.be/abc12345678");
        expect(deepLink("abc12345678", 0)).toBe("https://youtu.be/abc12345678");
        expect(deepLink("abc12345678", 92.9)).toBe("https://youtu.be/abc12345678?t=92");
    });

    it("reads ISO-8601 durations", () => {
        expect(parseIsoDuration("PT1H2M10S")).toBe(3730);
        expect(parseIsoDuration("PT45S")).toBe(45);
        expect(parseIsoDuration("P1DT1S")).toBe(86401);
        expect(parseIsoDuration("PT0S")).toBeNull();
        expect(parseIsoDuration("nope")).toBeNull();
    });
});

describe("Scout chapter parsing", () => {
    it("accepts the shapes creators use and sorts them", () => {
        const chapters = parseDescriptionChapters(
            [
                "00:00 Intro",
                "0:00 - Duplicate intro",
                "12:30 Demo",
                "(25:10) Refactoring",
                "* 1:02:03 Deep dive",
                "No timestamp here",
            ].join("\n"),
        );

        expect(chapters).toEqual([
            { startSeconds: 0, title: "Intro" },
            { startSeconds: 750, title: "Demo" },
            { startSeconds: 1510, title: "Refactoring" },
            { startSeconds: 3723, title: "Deep dive" },
        ]);
    });

    it("sorts an out-of-order description instead of dropping lines", () => {
        const chapters = parseDescriptionChapters("10:00 Second\n02:00 First");
        expect(chapters).toEqual([
            { startSeconds: 120, title: "First" },
            { startSeconds: 600, title: "Second" },
        ]);
    });

    it("returns nothing without a description", () => {
        expect(parseDescriptionChapters(null)).toEqual([]);
        expect(parseDescriptionChapters("just prose")).toEqual([]);
    });
});

describe("Scout quote validation", () => {
    const source = "So the first rule of refactoring is: make the change easy, then make the easy change.";

    it("matches quotes across punctuation, case and curly quotes", () => {
        expect(quoteAppearsIn("make the change easy, then make the easy change", source)).toBe(true);
        expect(quoteAppearsIn("MAKE THE CHANGE EASY — THEN MAKE THE EASY CHANGE", source)).toBe(true);
        expect(quoteAppearsIn("The first rule of refactoring", source)).toBe(true);
    });

    it("rejects quotes that are not in the source", () => {
        expect(quoteAppearsIn("always rewrite the whole module first", source)).toBe(false);
    });

    it("rejects short quotes that would match almost anything", () => {
        expect(quoteAppearsIn("the change", source)).toBe(false);
    });

    it("normalizes curly quotes and collapses whitespace", () => {
        expect(normalizeForMatch("Don\u2019t   panic")).toBe("don't panic");
    });
});

describe("Scout chunking", () => {
    it("keeps short text in one chunk and splits long text with overlap", () => {
        expect(chunkText("")).toEqual([]);
        expect(chunkText("short text")).toEqual(["short text"]);

        const text = `${"a".repeat(400)}\n\n${"b".repeat(400)}`;
        const chunks = chunkText(text, 500, 50);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0].length).toBeLessThanOrEqual(500);
        expect(chunks.join("")).toContain("b");
    });
});
