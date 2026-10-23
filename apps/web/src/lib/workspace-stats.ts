import type { Roadmap, TaskGroup } from "@/types";

export type RoadmapProgressState = "not-started" | "in-progress" | "completed";

export interface RoadmapStats {
    moduleCount: number;
    totalTasks: number;
    completedTasks: number;
    percent: number;
    progressState: RoadmapProgressState;
}

function countTaskGroup(group: TaskGroup) {
    const tasks = Array.isArray(group.tasks) ? group.tasks : [];
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed || task.done).length;

    return {
        total,
        completed,
    };
}

export function getRoadmapStats(roadmap: Roadmap): RoadmapStats {
    let totalTasks = 0;
    let completedTasks = 0;

    for (const section of roadmap.sections) {
        if (section.type === "tasks") {
            for (const group of section.data) {
                const counts = countTaskGroup(group);
                totalTasks += counts.total;
                completedTasks += counts.completed;
            }
        }

        if (section.type === "module") {
            const tasks = Array.isArray(section.data.tasks) ? section.data.tasks : [];
            totalTasks += tasks.length;
            completedTasks += tasks.filter((task) => task.completed || task.done).length;
        }
    }

    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const progressState: RoadmapProgressState =
        percent === 100 ? "completed" : percent > 0 ? "in-progress" : "not-started";

    return {
        moduleCount: roadmap.sections.filter((section) => section.type === "module").length,
        totalTasks,
        completedTasks,
        percent,
        progressState,
    };
}

export function getRoadmapDisplayTitle(roadmap: Roadmap): string {
    if (roadmap.title && roadmap.title !== "Untitled Course") {
        return roadmap.title;
    }

    const lines = (roadmap.rawContent || "").split("\n");
    const firstHeading = lines.find((line) => line.startsWith("#") || line.trim().length > 0);

    if (!firstHeading) {
        return "Untitled Workspace";
    }

    return firstHeading.replace(/^#+\s*/, "").trim() || "Untitled Workspace";
}

export function getRelativeTimeLabel(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(dateStr));
}

export function getRoadmapStateLabel(progressState: RoadmapProgressState): string {
    if (progressState === "completed") return "Completed";
    if (progressState === "in-progress") return "In progress";
    return "Ready to start";
}
