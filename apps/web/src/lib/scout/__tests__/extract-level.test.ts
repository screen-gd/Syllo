import { describe, expect, it } from "vitest";
import { mergeExtractionLevels } from "@/lib/scout/extract";

describe("mergeExtractionLevels", () => {
    it("picks the majority level across chunks", () => {
        expect(
            mergeExtractionLevels([
                { level: "basics" },
                { level: "intermediate" },
                { level: "basics" },
            ]),
        ).toBe("basics");
    });

    it("breaks ties toward the higher level", () => {
        expect(
            mergeExtractionLevels([{ level: "basics" }, { level: "advanced" }]),
        ).toBe("advanced");
        expect(
            mergeExtractionLevels([
                { level: "intermediate" },
                { level: "basics" },
            ]),
        ).toBe("intermediate");
    });

    it("returns null for no outputs or all-null levels", () => {
        expect(mergeExtractionLevels([])).toBeNull();
        expect(
            mergeExtractionLevels([{ level: null }, {}]),
        ).toBeNull();
    });
});
