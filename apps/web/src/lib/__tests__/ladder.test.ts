import { describe, expect, it } from "vitest";
import { getLadder, levelUpReady, nextCoreItem } from "@/lib/ladder";
import type {
    LearningLevel,
    ModuleSection,
    Roadmap,
    Section,
    Task,
} from "@/types";

function makeTask(id: string, extra: Partial<Task> = {}): Task {
    return {
        id,
        title: `Task ${id}`,
        completed: false,
        notes: "",
        subtasks: [],
        attachments: [],
        ...extra,
    };
}

function videoTask(id: string, extra: Partial<Task> = {}): Task {
    return makeTask(id, {
        attachments: [
            {
                id: `att_${id}`,
                title: id,
                url: `https://youtu.be/${id.padEnd(11, "x")}`,
                type: "video",
                description: "",
            },
        ],
        ...extra,
    });
}

function articleTask(id: string, extra: Partial<Task> = {}): Task {
    return makeTask(id, {
        attachments: [
            {
                id: `att_${id}`,
                title: id,
                url: `https://example.com/${id}`,
                type: "link",
                description: "",
            },
        ],
        ...extra,
    });
}

function moduleSection(
    id: string,
    order: number,
    tasks: Task[],
    extra: { level?: LearningLevel; track?: "reading" } = {},
): ModuleSection {
    return {
        id,
        title: id,
        order,
        type: "module",
        ...(extra.level !== undefined ? { level: extra.level } : {}),
        ...(extra.track !== undefined ? { track: extra.track } : {}),
        data: {
            description: "",
            tasks,
            resources: [],
            videos: [],
            completed: false,
        },
    };
}

function roadmap(
    sections: Section[],
    difficulty?: Roadmap["difficulty"],
): Roadmap {
    return {
        id: "r1",
        title: "Roadmap",
        mode: "general",
        sections,
        rawContent: "",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...(difficulty !== undefined ? { difficulty } : {}),
    };
}

describe("getLadder", () => {
    it("treats roadmaps without levels as one all-core legacy level", () => {
        const map = roadmap(
            [
                moduleSection("m1", 0, [makeTask("t1"), makeTask("t2")]),
                {
                    id: "g1",
                    title: "Group",
                    order: 1,
                    type: "tasks",
                    data: [{ id: "tg", title: "Group", tasks: [makeTask("t3")] }],
                },
            ],
            "intermediate",
        );
        const ladder = getLadder(map);
        expect(ladder.legacy).toBe(true);
        expect(ladder.levels).toHaveLength(1);
        expect(ladder.levels[0].level).toBe("intermediate");
        expect(ladder.levels[0].items.map((item) => item.task.id)).toEqual([
            "t1",
            "t2",
            "t3",
        ]);
        expect(ladder.levels[0].coreTotal).toBe(3);
        expect(ladder.reading).toEqual([]);
    });

    it("labels a legacy level from the roadmap difficulty", () => {
        const beginner = getLadder(
            roadmap([moduleSection("m", 0, [makeTask("t")])], "beginner"),
        );
        const missing = getLadder(
            roadmap([moduleSection("m", 0, [makeTask("t")])]),
        );
        expect(beginner.levels[0].level).toBe("basics");
        expect(missing.levels[0].level).toBe("basics");
    });

    it("groups leveled modules, splits core from deeper, and collects reading", () => {
        const map = roadmap([
            moduleSection("m1", 0, [
                videoTask("v1", { core: true }),
                articleTask("a1", { core: false }),
            ], { level: "basics" }),
            moduleSection("m2", 1, [videoTask("v2", { core: true })], {
                level: "advanced",
            }),
            moduleSection("m3", 2, [makeTask("b1")], { track: "reading" }),
        ]);
        const ladder = getLadder(map);
        expect(ladder.legacy).toBe(false);
        expect(ladder.levels.map((level) => level.level)).toEqual([
            "basics",
            "advanced",
        ]);
        expect(ladder.levels[0].core.map((item) => item.task.id)).toEqual(["v1"]);
        expect(ladder.levels[0].deeper.map((item) => item.task.id)).toEqual(["a1"]);
        expect(ladder.reading.map((item) => item.task.id)).toEqual(["b1"]);
        expect(ladder.current).toBe("basics");
    });

    it("lets unleveled sections inherit the closest preceding level", () => {
        const map = roadmap([
            {
                id: "g1",
                title: "Group",
                order: 0,
                type: "tasks",
                data: [{ id: "tg", title: "G", tasks: [makeTask("early")] }],
            },
            moduleSection("m1", 1, [videoTask("v1", { core: true })], {
                level: "intermediate",
            }),
            {
                id: "g2",
                title: "Group",
                order: 2,
                type: "tasks",
                data: [{ id: "tg2", title: "G2", tasks: [makeTask("later")] }],
            },
        ]);
        const ladder = getLadder(map);
        const intermediate = ladder.levels.find(
            (level) => level.level === "intermediate",
        );
        expect(ladder.levels).toHaveLength(1);
        expect(intermediate?.items.map((item) => item.task.id)).toEqual([
            "early",
            "v1",
            "later",
        ]);
    });

    it("advances current to the first incomplete level", () => {
        const map = roadmap([
            moduleSection("m1", 0, [videoTask("v1", { core: true, completed: true })], {
                level: "basics",
            }),
            moduleSection("m2", 1, [videoTask("v2", { core: true })], {
                level: "advanced",
            }),
        ]);
        const ladder = getLadder(map);
        expect(ladder.current).toBe("advanced");
        expect(ladder.levels[0].complete).toBe(true);
    });
});

describe("nextCoreItem", () => {
    it("prefers the first unfinished core video in the current level", () => {
        const map = roadmap([
            moduleSection("m1", 0, [
                articleTask("a1", { core: true }),
                videoTask("v1", { core: true }),
            ], { level: "basics" }),
        ]);
        expect(nextCoreItem(map)?.task.id).toBe("v1");
    });

    it("honours excludeTaskId and returns the next core item", () => {
        const map = roadmap([
            moduleSection("m1", 0, [
                articleTask("a1", { core: true }),
                videoTask("v1", { core: true }),
            ], { level: "basics" }),
        ]);
        expect(nextCoreItem(map, { excludeTaskId: "v1" })?.task.id).toBe("a1");
    });

    it("skips go-deeper and reading items entirely", () => {
        const map = roadmap([
            moduleSection("m1", 0, [
                videoTask("v1", { core: true, done: true }),
                videoTask("v2", { core: false }),
            ], { level: "basics" }),
            moduleSection("m3", 1, [makeTask("b1")], { track: "reading" }),
        ]);
        expect(nextCoreItem(map)).toBeNull();
    });

    it("continues to the next level when the current one has nothing left", () => {
        const map = roadmap([
            moduleSection("m1", 0, [videoTask("v1", { core: true })], {
                level: "basics",
            }),
            moduleSection("m2", 1, [videoTask("v2", { core: true })], {
                level: "intermediate",
            }),
        ]);
        expect(
            nextCoreItem(map, { excludeTaskId: "v1" })?.task.id,
        ).toBe("v2");
    });
});

describe("levelUpReady", () => {
    const leveled = (intermediateDone: boolean) =>
        roadmap([
            moduleSection("m1", 0, [videoTask("v1", { core: true, completed: true })], {
                level: "basics",
            }),
            moduleSection("m2", 1, [
                videoTask("v2", { core: true, completed: intermediateDone }),
            ], { level: "intermediate" }),
        ]);

    it("is ready right after a level finishes and not once the next has progress", () => {
        expect(levelUpReady(getLadder(leveled(false)))).toEqual({
            from: "basics",
            to: "intermediate",
        });
        expect(levelUpReady(getLadder(leveled(true)))).toBeNull();
    });

    it("is null while the first level is still in progress", () => {
        const map = roadmap([
            moduleSection("m1", 0, [videoTask("v1", { core: true })], {
                level: "basics",
            }),
            moduleSection("m2", 1, [videoTask("v2", { core: true })], {
                level: "intermediate",
            }),
        ]);
        expect(levelUpReady(getLadder(map))).toBeNull();
    });
});
