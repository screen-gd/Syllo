import type { LearningRecord } from "@/lib/workspace-persistence";

function day(value: Date) { return value.toLocaleDateString("en-CA"); }
function dayGap(from: string, to: string) { return Math.round(Math.abs(new Date(to).getTime() - new Date(from).getTime()) / 86_400_000); }

export function normalizeLearningRecord(record: LearningRecord, now = new Date()): LearningRecord {
    if (!record.lastActivityDate || dayGap(record.lastActivityDate, day(now)) <= 1) return record;
    return { ...record, currentStreak: 0 };
}

export function recordTaskCompletion(record: LearningRecord, now = new Date()): LearningRecord {
    const today = day(now);
    const gap = record.lastActivityDate ? dayGap(record.lastActivityDate, today) : null;
    const currentStreak = gap === 0 ? record.currentStreak : gap === 1 ? record.currentStreak + 1 : 1;
    return {
        ...record,
        currentStreak,
        lastActivityDate: today,
        tasksByDate: { ...record.tasksByDate, [today]: (record.tasksByDate[today] ?? 0) + 1 },
    };
}

export function unlockLearningBadge(record: LearningRecord, badgeId: string, unlockedAt = Date.now()): LearningRecord {
    if (record.unlockedBadges[badgeId]) return record;
    return { ...record, unlockedBadges: { ...record.unlockedBadges, [badgeId]: unlockedAt } };
}

export function addLearningTime(record: LearningRecord, moduleId: string | undefined, milliseconds: number): LearningRecord {
    return {
        ...record,
        sessionTimeMs: record.sessionTimeMs + milliseconds,
        moduleTimeMs: moduleId ? { ...record.moduleTimeMs, [moduleId]: (record.moduleTimeMs[moduleId] ?? 0) + milliseconds } : record.moduleTimeMs,
    };
}
