import { describe, expect, it } from "vitest";
import { agentResourcesSchema, buildResearchPrompt, extractJsonObject } from "@/lib/scout/agent-runner";

describe("Agent JSON extraction", () => {
    it("takes the outer object from prose or a code fence", () => {
        expect(extractJsonObject('Here you go:\n```json\n{"resources":[]}\n```\nDone.')).toEqual({ resources: [] });
        expect(extractJsonObject('{"ok":true} trailing words')).toEqual({ ok: true });
        expect(extractJsonObject('prefix {"nested":{"a":1}} suffix')).toEqual({ nested: { a: 1 } });
    });

    it("rejects output without a usable object", () => {
        expect(() => extractJsonObject("no json at all")).toThrow(/JSON object/);
        expect(() => extractJsonObject("{not json}")).toThrow(/invalid JSON/);
        expect(() => extractJsonObject("} backwards {")).toThrow(/JSON object/);
    });
});

describe("Agent resource validation", () => {
    it("accepts http(s) resources and optional notes", () => {
        const parsed = agentResourcesSchema.parse({
            resources: [
                {
                    title: "Refactoring UI",
                    url: "https://www.refactoringui.com/",
                    note: "A practical guide to visual hierarchy.",
                    skill: "UI design",
                },
                { title: "MDN", url: "https://developer.mozilla.org/" },
            ],
        });

        expect(parsed.resources).toHaveLength(2);
        expect(parsed.resources[0].skill).toBe("UI design");
    });

    it("rejects non-URLs, empty lists and oversized batches", () => {
        expect(() => agentResourcesSchema.parse({ resources: [] })).toThrow();
        expect(() => agentResourcesSchema.parse({ resources: [{ title: "x", url: "not a url" }] })).toThrow();
        expect(() =>
            agentResourcesSchema.parse({
                resources: Array.from({ length: 13 }, (_, index) => ({
                    title: `Resource ${index}`,
                    url: `https://example.com/${index}`,
                })),
            }),
        ).toThrow();
    });
});

describe("Agent research prompt", () => {
    it("states the goal, the free-only rule and the JSON shape", () => {
        const prompt = buildResearchPrompt("  UI design for developers  ");

        expect(prompt).toContain("Goal: UI design for developers");
        expect(prompt).toContain("No paid courses");
        expect(prompt).toContain('"resources"');
        expect(prompt).not.toContain("  UI design");
    });
});
