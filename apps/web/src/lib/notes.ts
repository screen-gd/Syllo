import type { Roadmap } from "@/types";
import { getLearningTasks } from "./learning";
import type { LibraryBook, PersonalEntry, PersonalSnapshot } from "./personal/schema";
import { personalEntries, putPersonalEntry } from "./personal/store";
import { formatTimestamp } from "./scout/format";

export type NoteKind = "note" | "practice" | "recall" | "highlight";

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
    note: "Note",
    practice: "Practice",
    recall: "Explained back",
    highlight: "Highlight",
};

/** Where a note was taken, with enough to link back to that spot. */
export type NoteSource =
    | {
          kind: "lesson";
          roadmapId: string;
          taskId: string;
          seconds: number;
          timed: boolean;
      }
    | { kind: "book"; bookId: string; cfi: string };

export interface LearnerNote {
    id: string;
    kind: NoteKind;
    text: string;
    quote: string;
    updatedAt: number;
    createdAt: string;
    /** Topic or book title; "General" for notes filed under no topic. */
    groupId: string;
    groupTitle: string;
    /** Lesson title or book chapter line shown above the note. */
    sourceTitle: string;
    source: NoteSource;
}

export interface NoteGroup {
    id: string;
    title: string;
    kind: "topic" | "book" | "general";
    notes: LearnerNote[];
}

const GENERAL_GROUP = "general";

function noteKind(id: string): NoteKind {
    if (id.startsWith("annotation:practice:")) return "practice";
    if (id.startsWith("annotation:recall:")) return "recall";
    return "note";
}

/**
 * Every note the learner has saved, newest first: lesson notes, practice
 * notes, explain-it-back answers and book highlights. Notes whose topic or
 * book is gone stay listed under the name "Removed topic" or "Removed book".
 */
export function collectNotes(
    records: PersonalSnapshot,
    roadmaps: readonly Roadmap[],
): LearnerNote[] {
    const books = new Map<string, LibraryBook>(
        personalEntries(records, "book").map((entry) => [
            entry.data.id,
            entry.data,
        ]),
    );
    const topics = new Map(
        roadmaps.map((roadmap) => [
            roadmap.id,
            {
                title: roadmap.title,
                lessons: new Map(
                    getLearningTasks(roadmap).map((item) => [
                        item.task.id,
                        item.task.title || item.task.text || "Untitled lesson",
                    ]),
                ),
            },
        ]),
    );
    return personalEntries(records, "annotation")
        .map((entry): LearnerNote => {
            const { anchor } = entry.data;
            const base = {
                id: entry.id,
                text: entry.data.text,
                quote: entry.data.quote,
                updatedAt: entry.updatedAt,
                createdAt: entry.data.createdAt,
            };
            if (anchor.kind === "book") {
                const book = books.get(anchor.bookId);
                return {
                    ...base,
                    kind: "highlight",
                    groupId: `book:${anchor.bookId}`,
                    groupTitle: book?.title ?? "Removed book",
                    sourceTitle: book?.author ?? "",
                    source: {
                        kind: "book",
                        bookId: anchor.bookId,
                        cfi: anchor.cfi,
                    },
                };
            }
            const kind = noteKind(entry.id);
            const topic = topics.get(anchor.roadmapId);
            return {
                ...base,
                kind,
                groupId: anchor.roadmapId || GENERAL_GROUP,
                groupTitle: anchor.roadmapId
                    ? (topic?.title ?? "Removed topic")
                    : "General",
                sourceTitle: topic?.lessons.get(anchor.taskId) ?? "",
                source: {
                    kind: "lesson",
                    roadmapId: anchor.roadmapId,
                    taskId: anchor.taskId,
                    seconds: anchor.seconds,
                    timed: kind === "note" && anchor.taskId !== "",
                },
            };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Case-insensitive match over a note's text, quote and where it came from. */
export function matchesNote(note: LearnerNote, query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [note.text, note.quote, note.groupTitle, note.sourceTitle].some(
        (value) => value.toLowerCase().includes(needle),
    );
}

/** Groups keep the order of their most recent note. */
export function groupNotes(notes: readonly LearnerNote[]): NoteGroup[] {
    const groups = new Map<string, NoteGroup>();
    for (const note of notes) {
        const group = groups.get(note.groupId) ?? {
            id: note.groupId,
            title: note.groupTitle,
            kind:
                note.source.kind === "book"
                    ? "book"
                    : note.groupId === GENERAL_GROUP
                      ? "general"
                      : "topic",
            notes: [],
        };
        group.notes.push(note);
        groups.set(note.groupId, group);
    }
    return [...groups.values()];
}

/** A Markdown file of the given groups, for use outside Syllo. */
export function notesToMarkdown(groups: readonly NoteGroup[]) {
    const lines = ["# Syllo notes", ""];
    for (const group of groups) {
        lines.push(`## ${group.title}`, "");
        for (const note of group.notes) {
            const where = [
                note.sourceTitle,
                note.source.kind === "lesson" && note.source.timed
                    ? formatTimestamp(note.source.seconds)
                    : "",
                note.kind === "note" ? "" : NOTE_KIND_LABEL[note.kind],
            ].filter(Boolean);
            if (where.length) lines.push(`**${where.join(" · ")}**`, "");
            if (note.quote)
                lines.push(
                    ...note.quote.split("\n").map((line) => `> ${line}`),
                    "",
                );
            if (note.text) lines.push(note.text, "");
        }
    }
    return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Save a note that belongs to a topic as a whole, or to no topic when
 * `roadmapId` is empty. Lesson notes are written from the lesson view.
 */
export function createTopicNote(roadmapId: string, text: string) {
    putPersonalEntry({
        kind: "annotation",
        id: `annotation:${crypto.randomUUID()}`,
        updatedAt: Date.now(),
        deleted: false,
        data: {
            text: text.trim(),
            quote: "",
            color: "#b7c9e8",
            createdAt: new Date().toISOString(),
            anchor: {
                kind: "lesson",
                roadmapId,
                taskId: "",
                url: "",
                seconds: 0,
            },
        },
    });
}

/** Replace a saved note's text, keeping its anchor and creation date. */
export function updateNoteText(
    entry: Extract<PersonalEntry, { kind: "annotation" }>,
    text: string,
) {
    putPersonalEntry({ ...entry, data: { ...entry.data, text: text.trim() } });
}
