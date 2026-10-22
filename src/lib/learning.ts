import type { Resource, Roadmap, Section, Task, Video } from "@/types";
import { detectPlatform } from "./video-utils";
import { getStorage } from "./storage";

export interface LearningTask {
    task: Task;
    sectionId: string;
    sectionTitle: string;
    resources: Resource[];
}
function videoResource(video: Video): Resource {
    return {
        id: video.id,
        title: video.title,
        url: video.url,
        type: "video",
        description: video.description,
    };
}

export function getLearningTasks(roadmap: Roadmap): LearningTask[] {
    return [...roadmap.sections]
        .sort((a, b) => a.order - b.order)
        .flatMap((section): LearningTask[] => {
            function wrap(
                tasks: Task[],
                resources: Resource[],
                title = section.title,
            ) {
                return tasks.map((task) => ({
                    task,
                    sectionId: section.id,
                    sectionTitle: title,
                    resources: [...task.attachments, ...resources].filter(
                        (resource, index, all) =>
                            all.findIndex(
                                (item) => item.url === resource.url,
                            ) === index,
                    ),
                }));
            }
            switch (section.type) {
                case "module":
                    return wrap(section.data.tasks, [
                        ...section.data.videos.map(videoResource),
                        ...section.data.resources,
                    ]);
                case "tasks":
                    return section.data.flatMap((group) =>
                        wrap(group.tasks, [], group.title),
                    );
                case "milestones":
                    return section.data.flatMap((milestone) =>
                        wrap(
                            milestone.tasks,
                            [
                                ...milestone.videos.map(videoResource),
                                ...milestone.resources,
                            ],
                            milestone.title,
                        ),
                    );
                default:
                    return [];
            }
        });
}

export function nextLearningTask(roadmap: Roadmap) {
    return (
        getLearningTasks(roadmap).find(
            (item) => !item.task.completed && !item.task.done,
        ) ?? null
    );
}
export function taskVideo(item: LearningTask) {
    return item.resources.find(
        (resource) =>
            resource.type === "video" ||
            detectPlatform(resource.url) !== "other",
    );
}

export function setLearningTaskDone(
    roadmap: Roadmap,
    taskId: string,
    completed: boolean,
) {
    const update = (task: Task) =>
        task.id === taskId ? { ...task, completed, done: completed } : task;
    const sections = roadmap.sections.map((section): Section => {
        if (section.type === "module")
            return {
                ...section,
                data: {
                    ...section.data,
                    tasks: section.data.tasks.map(update),
                },
            };
        if (section.type === "tasks")
            return {
                ...section,
                data: section.data.map((group) => ({
                    ...group,
                    tasks: group.tasks.map(update),
                })),
            };
        if (section.type === "milestones")
            return {
                ...section,
                data: section.data.map((milestone) => ({
                    ...milestone,
                    tasks: milestone.tasks.map(update),
                })),
            };
        return section;
    });
    getStorage().saveRoadmap({
        ...roadmap,
        sections,
        updatedAt: new Date().toISOString(),
    });
}

export function safeResourceUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}
