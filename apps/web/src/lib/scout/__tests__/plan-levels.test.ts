import { describe, expect, it } from "vitest";
import {
    buildRoadmap,
    CORE_STARTING_REASON,
    normalizeModules,
    planSchema,
    type ScoutPlan,
} from "@/lib/scout/plan";
import type { ScoutResource } from "@/lib/scout/types";

function resource(
    id: string,
    kind: ScoutResource["kind"],
    extra: Partial<ScoutResource> = {},
): ScoutResource {
    return {
        id,
        kind,
        source: "test",
        url: `https://example.com/${id}`,
        title: `Resource ${id}`,
        keyPoints: [],
        skillTags: [],
        chapters: [],
        transcriptStatus: "ok",
        transcriptChars: 400,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...extra,
    };
}

function plan(modules: unknown[]): ScoutPlan {
    return planSchema.parse({ title: "Goal", summary: "Summary", modules });
}

function task(resourceId: string, extra: Record<string, unknown> = {}) {
    return { title: `Task on ${resourceId}`, resourceId, ...extra };
}

describe("plan schema", () => {
    it("applies defaults and catches an invalid level", () => {
        const parsed = plan([
            {
                title: "M",
                level: "expert",
                tasks: [task("v1")],
            },
            {
                title: "N",
                level: "advanced",
                tasks: [task("v2", { core: true, coreReason: "why" })],
            },
        ]);
        expect(parsed.modules[0].level).toBe("basics");
        expect(parsed.modules[0].tasks[0].core).toBe(false);
        expect(parsed.modules[0].tasks[0].coreReason).toBe("");
        expect(parsed.modules[1].level).toBe("advanced");
        expect(parsed.modules[1].tasks[0].core).toBe(true);
        expect(parsed.modules[1].tasks[0].coreReason).toBe("why");
    });
});

describe("normalizeModules", () => {
    it("sorts modules by level, basics first", () => {
        const resources = [resource("v1", "video"), resource("v2", "video"), resource("v3", "video")];
        const modules = normalizeModules({
            plan: plan([
                { title: "Hard", level: "advanced", tasks: [task("v1")] },
                { title: "Easy", level: "basics", tasks: [task("v2", { core: true })] },
                { title: "Mid", level: "intermediate", tasks: [task("v3")] },
            ]),
            resources,
        });
        expect(modules.map((module) => module.level)).toEqual([
            "basics",
            "intermediate",
            "advanced",
        ]);
    });

    it("moves book tasks into a last reading-track module that is never core", () => {
        const resources = [
            resource("b1", "book", {
                chapters: [
                    { startSeconds: 0, title: "Part one", url: "" },
                    { startSeconds: 1, title: "Part two", url: "" },
                ],
            }),
            resource("v1", "video"),
        ];
        const modules = normalizeModules({
            plan: plan([
                {
                    title: "Mixed",
                    level: "basics",
                    tasks: [
                        task("b1", { title: "Read Part one", core: true, coreReason: "book" }),
                        task("b1", { title: "Read Part two" }),
                        task("v1", { core: true }),
                    ],
                },
            ]),
            resources,
        });
        expect(modules).toHaveLength(2);
        const reading = modules[1];
        expect(reading.title).toBe("Reading track");
        expect(reading.track).toBe("reading");
        expect(reading.tasks).toHaveLength(2);
        expect(reading.tasks.every((entry) => !entry.core && entry.coreReason === "")).toBe(true);
        expect(modules[0].tasks).toHaveLength(1);
    });

    it("clears article core flags when the level has a video, and keeps them when it does not", () => {
        const withVideo = normalizeModules({
            plan: plan([
                {
                    title: "M",
                    level: "basics",
                    tasks: [
                        task("v1", { core: true }),
                        task("a1", { core: true, coreReason: "read me" }),
                    ],
                },
            ]),
            resources: [resource("v1", "video"), resource("a1", "article")],
        });
        expect(withVideo[0].tasks[0].core).toBe(true);
        expect(withVideo[0].tasks[1].core).toBe(false);
        expect(withVideo[0].tasks[1].coreReason).toBe("");

        const withoutVideo = normalizeModules({
            plan: plan([
                {
                    title: "M",
                    level: "basics",
                    tasks: [task("a1", { core: true, coreReason: "read me" }), task("a2")],
                },
            ]),
            resources: [resource("a1", "article"), resource("a2", "doc")],
        });
        expect(withoutVideo[0].tasks[0].core).toBe(true);
        expect(withoutVideo[0].tasks[0].coreReason).toBe("read me");
    });

    it("caps core at five distinct videos while chapter tasks count once", () => {
        const chapters = [
            { startSeconds: 0, title: "Intro", url: "" },
            { startSeconds: 100, title: "Body", url: "" },
        ];
        const resources = [
            resource("v1", "video", { chapters }),
            resource("v2", "video"),
            resource("v3", "video"),
            resource("v4", "video"),
            resource("v5", "video"),
            resource("v6", "video"),
        ];
        const modules = normalizeModules({
            plan: plan([
                {
                    title: "M",
                    level: "basics",
                    tasks: [
                        task("v1", { startSeconds: 0, core: true }),
                        task("v1", { startSeconds: 100, core: true }),
                        task("v2", { core: true }),
                        task("v3", { core: true }),
                        task("v4", { core: true }),
                        task("v5", { core: true }),
                        task("v6", { core: true }),
                    ],
                },
            ]),
            resources,
        });
        const coreIds = new Set(
            modules[0].tasks.filter((entry) => entry.core).map((entry) => entry.resourceId),
        );
        expect(coreIds).toEqual(new Set(["v1", "v2", "v3", "v4", "v5"]));
        expect(modules[0].tasks.filter((entry) => entry.core && entry.resourceId === "v1")).toHaveLength(2);
    });

    it("promotes up to three resources when a level has no core", () => {
        const modules = normalizeModules({
            plan: plan([
                {
                    title: "M",
                    level: "basics",
                    tasks: [task("v1"), task("v2"), task("v3"), task("v4")],
                },
            ]),
            resources: [
                resource("v1", "video"),
                resource("v2", "video"),
                resource("v3", "video"),
                resource("v4", "video"),
            ],
        });
        const core = modules[0].tasks.filter((entry) => entry.core);
        expect(new Set(core.map((entry) => entry.resourceId))).toEqual(new Set(["v1", "v2", "v3"]));
        expect(core.every((entry) => entry.coreReason === CORE_STARTING_REASON)).toBe(true);
    });

    it("clears reasons on non-core tasks and fills empty core reasons", () => {
        const modules = normalizeModules({
            plan: plan([
                {
                    title: "M",
                    level: "basics",
                    tasks: [
                        task("v1", { core: true, coreReason: "   " }),
                        task("v2", { core: true, coreReason: "covers the key idea" }),
                    ],
                },
            ]),
            resources: [resource("v1", "video"), resource("v2", "video")],
        });
        expect(modules[0].tasks[0].coreReason).toBe(CORE_STARTING_REASON);
        expect(modules[0].tasks[1].coreReason).toBe("covers the key idea");
    });

    it("keeps at most three modules per level and merges the overflow", () => {
        const resources = [
            resource("v1", "video"),
            resource("v2", "video"),
            resource("v3", "video"),
            resource("v4", "video"),
        ];
        const modules = normalizeModules({
            plan: plan([
                { title: "A", level: "basics", tasks: [task("v1", { core: true })] },
                { title: "B", level: "basics", tasks: [task("v2")] },
                { title: "C", level: "basics", tasks: [task("v3")] },
                { title: "D", level: "basics", tasks: [task("v4")] },
            ]),
            resources,
        });
        expect(modules).toHaveLength(3);
        expect(modules[2].tasks.map((entry) => entry.resourceId)).toEqual(["v3", "v4"]);
    });

    it("lands missing resources in the last level as non-core and books in reading", () => {
        const resources = [
            resource("v1", "video"),
            resource("v2", "video"),
            resource("b1", "book"),
        ];
        const modules = normalizeModules({
            plan: plan([
                { title: "Deep", level: "advanced", tasks: [task("v1", { core: true })] },
            ]),
            resources,
        });
        const alsoIncluded = modules.find((module) => module.title === "Also included");
        expect(alsoIncluded?.level).toBe("advanced");
        expect(alsoIncluded?.tasks.every((entry) => !entry.core)).toBe(true);
        const reading = modules.at(-1);
        expect(reading?.track).toBe("reading");
        expect(reading?.tasks[0].resourceId).toBe("b1");
    });
});

describe("buildRoadmap", () => {
    it("writes level, track, core and priority onto sections and tasks", () => {
        const resources = [resource("v1", "video"), resource("b1", "book")];
        const parsed = plan([
            {
                title: "M",
                level: "intermediate",
                tasks: [
                    task("v1", { core: true, coreReason: "key" }),
                    task("b1", { title: "Read b1" }),
                ],
            },
        ]);
        const modules = normalizeModules({ plan: parsed, resources });
        const roadmap = buildRoadmap("pack1", "goal", parsed, modules, resources);
        const moduleSections = roadmap.sections.filter(
            (section) => section.type === "module",
        );
        expect(moduleSections[0].level).toBe("intermediate");
        expect(moduleSections[0].metadata?.difficulty).toBe("intermediate");
        expect(moduleSections[0].data.tasks[0].core).toBe(true);
        expect(moduleSections[0].data.tasks[0].priority).toBe("core");
        expect(moduleSections[0].data.tasks[0].coreReason).toBe("key");

        const reading = moduleSections.at(-1);
        expect(reading?.track).toBe("reading");
        expect(reading?.level).toBeUndefined();
        expect(reading?.data.tasks[0].priority).toBe("optional");
        expect(reading?.data.tasks[0].core).toBe(false);
    });
});
