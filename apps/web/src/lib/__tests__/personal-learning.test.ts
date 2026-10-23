// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import {
    getPersonalSnapshot,
    mergePersonalEntries,
    personalEntries,
    putPersonalEntry,
    PERSONAL_STORAGE_KEY,
} from "@/lib/personal/store";
import {
    reviewSchema,
    personalEntrySchema,
    type PersonalEntry,
} from "@/lib/personal/schema";
import { scheduleReview } from "@/lib/reviews";
import { canonicalResourceUrl, dedupeResources } from "@/lib/scout/discovery";
import { getVideoStartSeconds } from "@/lib/video-utils";
import { assertFreeAi } from "@/lib/ai-policy";

beforeEach(() => {
    localStorage.clear();
    getPersonalSnapshot();
});

describe("local progress and sync", () => {
    it("keeps newer local edits and propagates deletion without resurrecting an older record", () => {
        const entry = {
            id: "timer:settings",
            kind: "timer",
            updatedAt: 10,
            deleted: false,
            data: { focus: 30, rest: 7 },
        } satisfies PersonalEntry;
        mergePersonalEntries([entry]);
        mergePersonalEntries([
            { ...entry, updatedAt: 9, data: { focus: 10, rest: 3 } },
        ]);
        expect(getPersonalSnapshot()[entry.id].data).toEqual({
            focus: 30,
            rest: 7,
        });
        mergePersonalEntries([{ ...entry, updatedAt: 11, deleted: true }]);
        mergePersonalEntries([entry]);
        expect(personalEntries(getPersonalSnapshot(), "timer")).toEqual([]);
        expect(
            JSON.parse(localStorage.getItem(PERSONAL_STORAGE_KEY) ?? "{}")[
                entry.id
            ].deleted,
        ).toBe(true);
    });
    it("makes local revisions newer than the synced revision even when clocks differ", () => {
        const entry = {
            id: "timer:settings",
            kind: "timer",
            updatedAt: Date.now() + 60_000,
            deleted: false,
            data: { focus: 25, rest: 5 },
        } satisfies PersonalEntry;
        mergePersonalEntries([entry]);
        putPersonalEntry({ ...entry, data: { focus: 40, rest: 10 } });
        expect(getPersonalSnapshot()[entry.id].updatedAt).toBe(
            entry.updatedAt + 1,
        );
    });
    it("rejects an invalid progress record before it can enter persistence", () => {
        expect(
            personalEntrySchema.safeParse({
                id: "bad",
                kind: "study",
                updatedAt: 1,
                data: { seconds: -1 },
            }).success,
        ).toBe(false);
        expect(localStorage.getItem(PERSONAL_STORAGE_KEY)).toBeNull();
    });
});

describe("review scheduling", () => {
    it("survives JSON persistence and continues the FSRS schedule with its source intact", () => {
        const now = new Date("2026-10-21T08:00:00Z");
        const initial = reviewSchema.parse({
            id: "card",
            roadmapId: "topic",
            prompt: "When would you use a tool?",
            answer: "When a model needs an external action.",
            easeFactor: 2.5,
            repetitions: 0,
            intervalDays: 0,
            dueAt: now.toISOString(),
            status: "suggested",
            source: {
                url: "https://www.youtube.com/watch?v=AbCdEf12345",
                seconds: 752,
                taskId: "one",
            },
        });
        const reviewed = scheduleReview(initial, Rating.Good, now);
        const restored = reviewSchema.parse(
            JSON.parse(JSON.stringify(reviewed)),
        );
        const again = scheduleReview(
            restored,
            Rating.Good,
            new Date(restored.dueAt),
        );
        expect(again.repetitions).toBe(2);
        expect(again.fsrs?.reps).toBe(2);
        expect(again.status).toBe("kept");
        expect(again.source).toEqual(initial.source);
        expect(new Date(again.dueAt).getTime()).toBeGreaterThan(
            new Date(restored.dueAt).getTime(),
        );
        expect(reviewSchema.safeParse(again).success).toBe(true);
    });
});

describe("source anchors and free mode", () => {
    it.each([
        ["?t=12m30s", 750],
        ["?start=752", 752],
        ["#t=1h2m3s", 3723],
        ["?t=-5", 0],
    ])("reads video offset %s", (suffix, seconds) => {
        expect(
            getVideoStartSeconds(`https://www.youtube.com/watch${suffix}`),
        ).toBe(seconds);
    });
    it("deduplicates YouTube formats while preserving case-sensitive video ids and page paths", () => {
        const first = "https://youtu.be/AbCdEf12345?t=752";
        expect(canonicalResourceUrl(first)).toBe(
            canonicalResourceUrl(
                "https://www.youtube.com/watch?v=AbCdEf12345&utm_source=test",
            ),
        );
        expect(canonicalResourceUrl(first)).not.toBe(
            canonicalResourceUrl("https://youtu.be/abcdef12345"),
        );
        expect(canonicalResourceUrl("https://example.org/Guide")).not.toBe(
            canonicalResourceUrl("https://example.org/guide"),
        );
        expect(
            dedupeResources(
                [first, "https://www.youtube.com/embed/AbCdEf12345"].map(
                    (url) => ({
                        kind: "video",
                        source: "test",
                        title: "Lesson",
                        url,
                    }),
                ),
            ),
        ).toHaveLength(1);
    });
    it("rejects paid providers and models before any request", () => {
        expect(() => assertFreeAi("gemini", "gemini-2.5-flash")).not.toThrow();
        expect(() => assertFreeAi("gemini", "gemini-2.5-pro")).toThrow();
        expect(() => assertFreeAi("deepseek", "deepseek-chat")).toThrow();
    });
});
