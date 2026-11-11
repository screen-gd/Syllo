// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
    collectGlossary,
    removeGlossaryTerm,
    upsertGlossaryTerm,
} from "@/lib/glossary";
import { setLearningTaskDone } from "@/lib/learning";
import { collectNotes, groupNotes, notesToMarkdown } from "@/lib/notes";
import { getPersonalSnapshot, putPersonalEntry } from "@/lib/personal/store";
import {
    collectReviews,
    createReview,
    deleteReview,
    formatInterval,
} from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import type { Roadmap } from "@/types";

const roadmap: Roadmap = {
    id: "r1",
    title: "Typography",
    mode: "general",
    rawContent: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
        {
            id: "m1",
            type: "module",
            title: "Basics",
            order: 0,
            data: {
                description: "",
                tasks: [
                    {
                        id: "t1",
                        title: "Kerning",
                        completed: false,
                        notes: "",
                        subtasks: [],
                        attachments: [],
                    },
                ],
                resources: [],
                videos: [],
                completed: false,
            },
        },
    ],
};

beforeEach(() => {
    localStorage.clear();
    getPersonalSnapshot();
});

describe("glossary", () => {
    it("creates a glossary on first term, then edits and removes in place", () => {
        const added = upsertGlossaryTerm(roadmap, {
            term: " Kerning ",
            definition: "Space between two letters.",
        });
        const [entry] = collectGlossary([added]);
        expect(entry.term.term).toBe("Kerning");
        expect(added.sections).toHaveLength(2);

        const edited = upsertGlossaryTerm(added, {
            id: entry.term.id,
            term: "Kerning",
            definition: "Adjusting space between a pair of letters.",
        });
        expect(collectGlossary([edited])).toHaveLength(1);
        expect(collectGlossary([edited])[0].term.definition).toMatch(/pair/);
        expect(
            collectGlossary([removeGlossaryTerm(edited, entry.term.id)]),
        ).toEqual([]);
    });
});

describe("notes", () => {
    it("labels notes by where they were taken and exports them", () => {
        const anchor = {
            kind: "lesson" as const,
            roadmapId: "r1",
            taskId: "t1",
            url: "https://example.com/v",
            seconds: 75,
        };
        const data = {
            quote: "",
            color: "#fff",
            createdAt: "2026-01-02T00:00:00.000Z",
        };
        putPersonalEntry({
            kind: "annotation",
            id: "annotation:a",
            updatedAt: 1,
            deleted: false,
            data: { ...data, text: "Pairs matter", anchor },
        });
        putPersonalEntry({
            kind: "annotation",
            id: "annotation:practice:r1:t1",
            updatedAt: 1,
            deleted: false,
            data: { ...data, text: "Tried it on a logo", anchor },
        });
        const notes = collectNotes(getPersonalSnapshot(), [roadmap]);
        expect(notes.map((note) => note.kind).sort()).toEqual([
            "note",
            "practice",
        ]);
        expect(notes[0].sourceTitle).toBe("Kerning");
        const markdown = notesToMarkdown(groupNotes(notes));
        expect(markdown).toContain("## Typography");
        expect(markdown).toContain("**Kerning · 1:15**");
        expect(markdown).toContain("**Kerning · Practice**");
    });
});

describe("reviews", () => {
    it("deletes a card and keeps it deleted", () => {
        const card = createReview({
            prompt: "Kerning?",
            answer: "Pair spacing",
            roadmapId: "r1",
            source: undefined,
        });
        expect(collectReviews([roadmap], getPersonalSnapshot())).toHaveLength(1);
        deleteReview(card);
        expect(collectReviews([roadmap], getPersonalSnapshot())).toEqual([]);
    });

    it("formats the time until a card is due", () => {
        const now = Date.parse("2026-01-01T00:00:00.000Z");
        expect(formatInterval("2026-01-01T00:10:00.000Z", now)).toBe("10m");
        expect(formatInterval("2026-01-04T00:00:00.000Z", now)).toBe("3d");
    });
});

describe("lesson completion", () => {
    it("counts a finished lesson once toward the streak", () => {
        getStorage().saveRoadmap(roadmap);
        const done = setLearningTaskDone(roadmap, "t1", true);
        setLearningTaskDone(done, "t1", true);
        const record = getStorage().getLearningRecord();
        expect(record.currentStreak).toBe(1);
        expect(Object.values(record.tasksByDate)).toEqual([1]);
    });
});
