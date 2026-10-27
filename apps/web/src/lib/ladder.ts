import {
    LEARNING_LEVELS,
    type LearningLevel,
    type ModuleSection,
    type Roadmap,
} from "@/types";
import { getLearningTasks, taskVideo, type LearningTask } from "./learning";

export type TaskRole = "core" | "deeper";

export interface LadderItem extends LearningTask {
    role: TaskRole;
    done: boolean;
    isVideo: boolean;
}

export interface LadderLevel {
    level: LearningLevel;
    items: LadderItem[];
    core: LadderItem[];
    deeper: LadderItem[];
    coreDone: number;
    coreTotal: number;
    complete: boolean;
}

export interface Ladder {
    levels: LadderLevel[];
    reading: LadderItem[];
    current: LearningLevel | null;
    legacy: boolean;
}

export const LEVEL_LABEL: Record<LearningLevel, string> = {
    basics: "Basics",
    intermediate: "Intermediate",
    advanced: "Advanced",
};

function toItem(item: LearningTask, role: TaskRole): LadderItem {
    return {
        ...item,
        role,
        done: item.task.completed || !!item.task.done,
        isVideo: taskVideo(item) !== undefined,
    };
}

function makeLevel(level: LearningLevel, items: LadderItem[]): LadderLevel {
    const core = items.filter((item) => item.role === "core");
    const deeper = items.filter((item) => item.role === "deeper");
    const coreDone = core.filter((item) => item.done).length;
    const complete =
        core.length > 0 ? coreDone === core.length : items.every((item) => item.done);
    return { level, items, core, deeper, coreDone, coreTotal: core.length, complete };
}

function legacyLevel(difficulty: Roadmap["difficulty"]): LearningLevel {
    switch (difficulty) {
        case "intermediate":
            return "intermediate";
        case "advanced":
            return "advanced";
        default:
            return "basics";
    }
}

/**
 * Reads any roadmap as a ladder. Roadmaps without leveled modules keep
 * working: every task counts as core on a single level named after the
 * roadmap's difficulty.
 */
export function getLadder(roadmap: Roadmap): Ladder {
    const sections = [...roadmap.sections].sort((a, b) => a.order - b.order);
    const bySectionId = new Map(sections.map((section) => [section.id, section]));
    const items = getLearningTasks(roadmap);

    const leveled = sections.some(
        (section) => section.type === "module" && section.level !== undefined,
    );

    if (!leveled) {
        const level = legacyLevel(roadmap.difficulty);
        const all = items.map((item) => toItem(item, "core"));
        const levels = all.length > 0 ? [makeLevel(level, all)] : [];
        return {
            levels,
            reading: [],
            current: levels.find((entry) => !entry.complete)?.level ?? null,
            legacy: true,
        };
    }

    const firstLevel =
        sections.find(
            (section): section is ModuleSection =>
                section.type === "module" && section.level !== undefined,
        )?.level ?? "basics";

    const buckets = new Map<LearningLevel, LadderItem[]>();
    const reading: LadderItem[] = [];
    let inherited = firstLevel;

    for (const item of items) {
        const section = bySectionId.get(item.sectionId);
        if (section?.type === "module" && section.track === "reading") {
            reading.push(toItem(item, item.task.core === false ? "deeper" : "core"));
            continue;
        }
        if (section?.type === "module" && section.level !== undefined) {
            inherited = section.level;
        }
        const level = section?.type === "module" && section.level !== undefined ? section.level : inherited;
        const bucket = buckets.get(level) ?? [];
        bucket.push(toItem(item, item.task.core === false ? "deeper" : "core"));
        buckets.set(level, bucket);
    }

    const levels = LEARNING_LEVELS.filter((level) => buckets.has(level)).map(
        (level) => makeLevel(level, buckets.get(level) ?? []),
    );

    return {
        levels,
        reading,
        current: levels.find((entry) => !entry.complete)?.level ?? null,
        legacy: false,
    };
}

/**
 * The one video to watch next: the first unfinished core item in the current
 * level, preferring videos, then the next incomplete levels in order.
 * Go-deeper and reading items never count.
 */
export function nextCoreItem(
    roadmap: Roadmap,
    options?: { excludeTaskId?: string },
): LadderItem | null {
    const ladder = getLadder(roadmap);
    const exclude = options?.excludeTaskId;
    const startIndex = ladder.levels.findIndex(
        (entry) => entry.level === ladder.current,
    );
    if (startIndex < 0) return null;

    for (const level of ladder.levels.slice(startIndex)) {
        const open = level.core.filter(
            (item) => !item.done && item.task.id !== exclude,
        );
        const picked = open.find((item) => item.isVideo) ?? open[0];
        if (picked) return picked;
    }
    return null;
}

/**
 * Non-null when a level was just finished and the next level is untouched,
 * which is the moment to show "level up" instead of "next video".
 */
export function levelUpReady(
    ladder: Ladder,
): { from: LearningLevel; to: LearningLevel } | null {
    if (ladder.current === null) return null;
    const index = ladder.levels.findIndex(
        (entry) => entry.level === ladder.current,
    );
    if (index <= 0) return null;
    const from = ladder.levels[index - 1];
    const to = ladder.levels[index];
    if (from.complete && to.coreDone === 0) return { from: from.level, to: to.level };
    return null;
}
