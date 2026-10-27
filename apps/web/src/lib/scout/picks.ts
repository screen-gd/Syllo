import { LEARNING_LEVELS, type LearningLevel } from "@/types";
import type { ScoutResource } from "./types";

export type PickRole = "core" | "deeper" | "reading";

export interface PickGroup {
    level: LearningLevel | "unsorted" | "reading";
    items: Array<{ resource: ScoutResource; role: PickRole }>;
}

export const PICK_GROUP_LABEL: Record<PickGroup["level"], string> = {
    basics: "Basics",
    intermediate: "Intermediate",
    advanced: "Advanced",
    unsorted: "Level set when the plan is built",
    reading: "Reading track",
};

export const PICK_ROLE_LABEL: Record<PickRole, string> = {
    core: "Core",
    deeper: "Go deeper",
    reading: "Reading",
};

/**
 * Groups approved picks the way the roadmap will treat them: levels first,
 * unsorted picks next, books last as the reading track. Within a level the
 * first few videos are core and the rest are optional depth.
 */
export function groupPicks(resources: ScoutResource[]): PickGroup[] {
    const byLevel = new Map<LearningLevel, ScoutResource[]>();
    const unsorted: ScoutResource[] = [];
    const reading: ScoutResource[] = [];

    for (const resource of resources) {
        if (resource.kind === "book") {
            reading.push(resource);
        } else if (resource.level) {
            const bucket = byLevel.get(resource.level) ?? [];
            bucket.push(resource);
            byLevel.set(resource.level, bucket);
        } else {
            unsorted.push(resource);
        }
    }

    const groups: PickGroup[] = [];
    const addLevel = (level: LearningLevel | "unsorted", items: ScoutResource[]) => {
        if (items.length === 0) return;
        const hasVideo = items.some((item) => item.kind === "video");
        const cap = hasVideo ? 5 : 3;
        let coreCount = 0;
        groups.push({
            level,
            items: items.map((resource) => {
                const eligible = hasVideo ? resource.kind === "video" : true;
                const role: PickRole = eligible && coreCount < cap ? (coreCount += 1, "core") : "deeper";
                return { resource, role };
            }),
        });
    };

    for (const level of LEARNING_LEVELS) addLevel(level, byLevel.get(level) ?? []);
    addLevel("unsorted", unsorted);
    if (reading.length > 0) {
        groups.push({
            level: "reading",
            items: reading.map((resource) => ({ resource, role: "reading" as const })),
        });
    }

    return groups;
}
