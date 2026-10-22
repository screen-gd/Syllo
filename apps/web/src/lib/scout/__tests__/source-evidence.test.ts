import { describe, expect, it, vi } from "vitest";
import { extractResource, suggestBookOutline } from "@/lib/scout/extract";
import { scoutGenerateObject } from "@/lib/scout/llm";

vi.mock("@/lib/scout/llm", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/scout/llm")>();
    return { ...actual, scoutGenerateObject: vi.fn() };
});

describe("source evidence", () => {
    it("anchors quotes to actual transcript segments and drops invented quotes", async () => {
        vi.mocked(scoutGenerateObject).mockResolvedValueOnce({
            object: {
                summary: "Tools connect a model to external actions.",
                keyPoints: [
                    {
                        text: "Tools allow a model to act outside its context.",
                        quote: "A tool connects the model to an external action.",
                        atSeconds: 999,
                    },
                    {
                        text: "A made-up idea that does not exist in the source.",
                        quote: "An invented quote that is absent from the transcript.",
                        atSeconds: 12,
                    },
                ],
                skills: ["tool calling"],
                chapters: [{ startSeconds: 999, title: "Invented chapter" }],
            },
            inputTokens: 50,
            outputTokens: 50,
        });
        const quote = "A tool connects the model to an external action.";
        const result = await extractResource({
            resource: {
                id: "video",
                kind: "video",
                title: "Tool calling",
                durationSeconds: 1200,
                externalId: "AbCdEf12345",
            },
            text: `Earlier we described a model. ${quote} Later we test its output.`,
            segments: [
                { start: 0, text: "Earlier we described a model." },
                { start: 371, text: quote },
                { start: 390, text: "Later we test its output." },
            ],
        });
        expect(result.keyPoints).toHaveLength(1);
        expect(result.keyPoints[0].atSeconds).toBe(371);
        expect(result.chapters[0].startSeconds).toBe(371);
        expect(
            result.chapters.some((chapter) => chapter.startSeconds === 999),
        ).toBe(false);
    });
    it("does not invent a table of contents from a book title", async () => {
        const result = await suggestBookOutline({
            title: "An unfamiliar book",
        });
        expect(result).toEqual({
            chapters: ["Read the book"],
            confident: false,
        });
    });
});
