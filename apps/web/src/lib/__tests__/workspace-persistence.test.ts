import { describe, expect, it } from "vitest";
import { MemoryWorkspaceStateAdapter, WorkspacePersistence } from "@/lib/workspace-persistence";
import type { Roadmap } from "@/types";

function roadmap(id = "one"): Roadmap {
    return { id, title: "Test", mode: "general", rawContent: "", sections: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" };
}

describe("WorkspacePersistence", () => {
    it("owns the full workspace lifecycle", () => {
        const persistence = new WorkspacePersistence(new MemoryWorkspaceStateAdapter());
        persistence.saveRoadmap(roadmap());
        persistence.saveSession("one", [{ id: "notes", type: "notes", title: "Notes", order: 0, data: [] }]);
        persistence.saveVersion(roadmap(), new Date("2026-01-02T00:00:00Z"));

        expect(persistence.getWorkspace("one", true)?.sections).toHaveLength(1);
        expect(persistence.getVersions("one")).toHaveLength(1);

        persistence.deleteRoadmap("one");
        expect(persistence.getRoadmap("one")).toBeNull();
        expect(persistence.getVersions("one")).toEqual([]);
    });

    it("returns safe copies", () => {
        const persistence = new WorkspacePersistence(new MemoryWorkspaceStateAdapter());
        persistence.saveRoadmap(roadmap());
        const copy = persistence.getRoadmaps();
        copy[0].title = "Changed";
        expect(persistence.getRoadmap("one")?.title).toBe("Test");
    });
});
