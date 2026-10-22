import { describe, expect, it } from "vitest";
import { normalizeRoadmapPayload } from "@/lib/server/roadmap-intake";

describe("Roadmap Intake", () => {
    it("normalizes provider output behind one test surface", () => {
        const result = normalizeRoadmapPayload({
            title: "Learn TypeScript",
            sections: [{ type: "module", title: "Basics", data: { tasks: [{ text: "Install TypeScript", done: true }] } }],
        }, { mode: "general", difficulty: "intermediate" });

        expect(result?.title).toBe("Learn TypeScript");
        expect(result?.difficulty).toBe("intermediate");
        expect(result?.sections).toHaveLength(1);
    });

    it("rejects output without valid sections", () => {
        expect(normalizeRoadmapPayload({ sections: [] }, {})).toBeNull();
        expect(normalizeRoadmapPayload(null, {})).toBeNull();
    });
});
