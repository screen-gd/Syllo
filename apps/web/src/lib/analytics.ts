import type { ProgressSnapshot, Roadmap } from "@/types";

function isModuleSection(section: Roadmap["sections"][number]) {
    return section.type === "module";
}

export function getRoadmapTaskTotals(roadmap: Roadmap) {
    const moduleSections = roadmap.sections.filter(isModuleSection);
    const totalTasks = moduleSections.reduce((count, section) => count + section.data.tasks.length, 0);
    const completedTasks = moduleSections.reduce(
        (count, section) => count + section.data.tasks.filter((task) => task.completed || task.done).length,
        0,
    );

    return { totalTasks, completedTasks };
}

export function getRoadmapCompletionRate(roadmap: Roadmap) {
    const { totalTasks, completedTasks } = getRoadmapTaskTotals(roadmap);
    if (totalTasks === 0) return 0;
    return completedTasks / totalTasks;
}

export function computeOverview(roadmaps: Roadmap[], snapshots: ProgressSnapshot[]) {
    const completionRates = roadmaps.map(getRoadmapCompletionRate);
    const averageCompletion = completionRates.length
        ? completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length
        : 0;

    const latestBySection = new Map<string, ProgressSnapshot>();
    for (const snapshot of snapshots) {
        const current = latestBySection.get(snapshot.sectionId);
        if (!current || current.createdAt < snapshot.createdAt) {
            latestBySection.set(snapshot.sectionId, snapshot);
        }
    }

    let mostCompletedModule = "";
    let mostCompletedRate = -1;
    let atRiskCount = 0;

    for (const roadmap of roadmaps) {
        for (const section of roadmap.sections.filter(isModuleSection)) {
            const snapshot = latestBySection.get(section.id);
            const rate = snapshot?.completionRate ?? 0;
            if (rate > mostCompletedRate) {
                mostCompletedRate = rate;
                mostCompletedModule = section.title;
            }

            const stale = snapshot ? Date.now() - new Date(snapshot.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000 : true;
            if (stale && rate < 0.5) {
                atRiskCount += 1;
            }
        }
    }

    return {
        totalInternsTracked: roadmaps.filter((roadmap) => roadmap.mode === "intern").length,
        averageCompletion,
        totalTasksCompletedThisMonth: snapshots
            .filter((snapshot) => {
                const createdAt = new Date(snapshot.createdAt);
                const now = new Date();
                return createdAt.getUTCFullYear() === now.getUTCFullYear() && createdAt.getUTCMonth() === now.getUTCMonth();
            })
            .reduce((sum, snapshot) => sum + snapshot.completedTasks, 0),
        mostCompletedModule,
        atRiskModules: atRiskCount,
    };
}

export function buildVelocitySeries(snapshots: ProgressSnapshot[], days = 14) {
    const today = new Date();
    const buckets = Array.from({ length: days }, (_, offset) => {
        const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - offset - 1)));
        const key = current.toISOString().slice(0, 10);
        return { date: key, completedTasks: 0 };
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));
    for (const snapshot of snapshots) {
        const key = snapshot.createdAt.slice(0, 10);
        const bucket = bucketMap.get(key);
        if (bucket) {
            bucket.completedTasks += snapshot.completedTasks;
        }
    }

    return buckets;
}
