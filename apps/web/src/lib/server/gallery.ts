import type { PublicRoadmapCard, Roadmap } from "@/types";
import { SEEDED_GALLERY_ROADMAPS, toSeedCard } from "@/lib/gallery";
import {
    getStoredRoadmap,
    incrementStoredForkCount,
    listStoredRoadmaps,
    setStoredRoadmapPublic,
    upsertStoredRoadmap,
} from "@/lib/server/store";

function toCard(roadmap: Roadmap): PublicRoadmapCard {
    const moduleCount = roadmap.sections.filter((section) => section.type === "module").length;
    return {
        id: roadmap.id,
        title: roadmap.title,
        summary: roadmap.summary,
        mode: roadmap.mode,
        contentType: roadmap.contentType,
        difficulty: roadmap.difficulty,
        totalEstimatedDuration: roadmap.totalEstimatedDuration,
        moduleCount,
        forkCount: roadmap.forkCount ?? 0,
        updatedAt: roadmap.updatedAt,
    };
}

function cloneRoadmapForFork(roadmap: Roadmap, sourceId: string): Roadmap {
    const timestamp = new Date().toISOString();
    return {
        ...roadmap,
        id: `rm_${Math.random().toString(36).slice(2, 10)}`,
        title: `${roadmap.title} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
        isPublic: false,
        forkedFrom: sourceId,
        forkCount: 0,
        sections: roadmap.sections.map((section) => {
            if (section.type === "module") {
                return {
                    ...section,
                    data: {
                        ...section.data,
                        completed: false,
                        tasks: section.data.tasks.map((task) => ({
                            ...task,
                            completed: false,
                            done: false,
                            subtasks: task.subtasks.map((subtask) => ({
                                ...subtask,
                                completed: false,
                            })),
                        })),
                    },
                };
            }

            if (section.type === "milestones") {
                return {
                    ...section,
                    data: section.data.map((milestone) => ({
                        ...milestone,
                        completed: false,
                        tasks: milestone.tasks.map((task) => ({
                            ...task,
                            completed: false,
                            done: false,
                            subtasks: task.subtasks.map((subtask) => ({
                                ...subtask,
                                completed: false,
                            })),
                        })),
                    })),
                };
            }

            if (section.type === "tasks") {
                return {
                    ...section,
                    data: section.data.map((group) => ({
                        ...group,
                        tasks: group.tasks.map((task) => ({
                            ...task,
                            completed: false,
                            done: false,
                            subtasks: task.subtasks.map((subtask) => ({
                                ...subtask,
                                completed: false,
                            })),
                        })),
                    })),
                };
            }

            return section;
        }),
    };
}

export async function listGallery(options?: {
    query?: string;
    mode?: string;
    contentType?: string;
}) {
    const seeded = SEEDED_GALLERY_ROADMAPS.map(toSeedCard);
    const localPublic = listStoredRoadmaps()
        .filter((roadmap) => roadmap.isPublic)
        .map(toCard);

    const query = options?.query?.trim().toLowerCase();

    return [...seeded, ...localPublic].filter((card) => {
        if (options?.mode && card.mode !== options.mode) return false;
        if (options?.contentType && card.contentType !== options.contentType) return false;
        if (!query) return true;
        return [card.title, card.summary, card.contentType].some((value) => value?.toLowerCase().includes(query));
    });
}

export async function setWorkspacePublic(workspaceId: string, isPublic: boolean, roadmap?: Roadmap) {
    if (roadmap) {
        upsertStoredRoadmap({
            ...roadmap,
            id: workspaceId,
            isPublic,
        });
        return { success: true };
    }

    const updated = setStoredRoadmapPublic(workspaceId, isPublic);
    if (!updated) {
        throw new Error("Workspace must be synced before it can be published");
    }

    return { success: true };
}

export async function forkGalleryRoadmap(workspaceId: string) {
    const seeded = SEEDED_GALLERY_ROADMAPS.find((roadmap) => roadmap.id === workspaceId);
    let sourceRoadmap: Roadmap | null = seeded ?? null;

    if (!sourceRoadmap) {
        const stored = getStoredRoadmap(workspaceId);
        if (!stored?.isPublic) {
            throw new Error("Workspace is not public");
        }
        sourceRoadmap = stored;
        incrementStoredForkCount(workspaceId);
    }

    const forked = cloneRoadmapForFork(sourceRoadmap, workspaceId);
    upsertStoredRoadmap(forked);

    return forked;
}
