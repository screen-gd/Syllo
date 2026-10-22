import { describe, expect, it } from "vitest";
import { addLearningTime, normalizeLearningRecord, recordTaskCompletion, unlockLearningBadge } from "@/lib/learning-session";
import type { LearningRecord } from "@/lib/workspace-persistence";

const empty = (): LearningRecord => ({ currentStreak: 0, lastActivityDate: null, tasksByDate: {}, unlockedBadges: {}, sessionTimeMs: 0, moduleTimeMs: {}, moduleStartedAt: {} });

describe("learning session transitions", () => {
  it("records daily work and advances a streak once per day", () => {
    const first = recordTaskCompletion(empty(), new Date("2026-08-10T12:00:00"));
    const second = recordTaskCompletion(first, new Date("2026-08-11T12:00:00"));
    const sameDay = recordTaskCompletion(second, new Date("2026-08-11T13:00:00"));
    expect(sameDay.currentStreak).toBe(2);
    expect(sameDay.tasksByDate["2026-08-11"]).toBe(2);
  });

  it("expires a broken streak and records time and badges", () => {
    const stale = { ...empty(), currentStreak: 4, lastActivityDate: "2026-08-01" };
    const normalized = normalizeLearningRecord(stale, new Date("2026-08-04T12:00:00"));
    const timed = addLearningTime(normalized, "module-1", 1000);
    const badged = unlockLearningBadge(timed, "first_step", 123);
    expect(badged.currentStreak).toBe(0);
    expect(badged.moduleTimeMs["module-1"]).toBe(1000);
    expect(badged.unlockedBadges.first_step).toBe(123);
  });
});
