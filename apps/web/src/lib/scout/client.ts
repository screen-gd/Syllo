import type { Roadmap, SrsItem } from "@/types";
import type { ScoutPackDetail } from "./pack";
import type { ScoutResource } from "./types";
import { getStorage } from "@/lib/storage";

/**
 * Browser-side Scout state.
 *
 * The server owns discovery and the pack pipeline; the learner owns the
 * workspace. Publishing copies the finished pack into the same localStorage
 * store every other Syllo screen reads, keyed by stable ids so republishing a
 * pack updates the workspace instead of duplicating it.
 */

const LAST_PACK_KEY = "syllo:scout:last-pack";
const BOOKSHELF_KEY = "syllo:scout:bookshelf";
const WEEK_KEY = "syllo:scout:week";

export interface ScoutLastPack {
    packId: string;
    roadmapId: string;
    goal: string;
    title: string;
    at: string;
}

export interface BookProgress {
    /** Chapter indexes the learner has finished. */
    completed: number[];
    lastChapter: number;
    updatedAt: string;
}

export interface ScoutLocalStats {
    minutesWatched: number;
    tasksCompleted: number;
    reviewDue: number;
}

function read<T>(key: string): T | null {
    if (typeof localStorage === "undefined") return null;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown) {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or blocked: Scout state is a convenience, never a gate.
    }
}

export function getLastScoutPack(): ScoutLastPack | null {
    return read<ScoutLastPack>(LAST_PACK_KEY);
}

export function forgetLastScoutPack() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LAST_PACK_KEY);
}

/**
 * Copy a ready pack into the learner's workspace. Returns the roadmap id, or
 * null when the pack has no roadmap yet.
 */
export function publishScoutPack(detail: ScoutPackDetail): string | null {
    if (!detail.roadmap) return null;

    const roadmap: Roadmap = {
        ...detail.roadmap,
        packVersion: detail.roadmap.packVersion ?? `scout-${detail.id}`,
        updatedAt: new Date().toISOString(),
    };

    const storage = getStorage();
    storage.saveRoadmap(roadmap);
    if (detail.quizzes.length > 0) storage.saveReviews(roadmap.id, detail.quizzes.map(card => ({ ...card, status: "suggested" })));
    storage.saveVersion(roadmap);

    const record: ScoutLastPack = {
        packId: detail.id,
        roadmapId: roadmap.id,
        goal: detail.goal,
        title: roadmap.title,
        at: new Date().toISOString(),
    };
    write(LAST_PACK_KEY, record);

    return roadmap.id;
}

export function getBookshelf(): Record<string, BookProgress> {
    return read<Record<string, BookProgress>>(BOOKSHELF_KEY) ?? {};
}

export function saveBookshelf(shelf: Record<string, BookProgress>) {
    write(BOOKSHELF_KEY, shelf);
}

export function getBookProgress(bookId: string): BookProgress {
    return getBookshelf()[bookId] ?? { completed: [], lastChapter: 0, updatedAt: new Date().toISOString() };
}

export function setChapterDone(bookId: string, chapterIndex: number, done: boolean): BookProgress {
    const shelf = getBookshelf();
    const current = shelf[bookId] ?? { completed: [], lastChapter: 0, updatedAt: new Date().toISOString() };
    const completed = done
        ? [...new Set([...current.completed, chapterIndex])].sort((a, b) => a - b)
        : current.completed.filter((index) => index !== chapterIndex);

    const next: BookProgress = {
        completed,
        lastChapter: chapterIndex,
        updatedAt: new Date().toISOString(),
    };
    shelf[bookId] = next;
    saveBookshelf(shelf);
    return next;
}

/** Total chapters for a book, with a one-step fallback for books without an outline. */
export function bookChapterCount(book: ScoutResource) {
    return Math.max(1, book.chapters.length);
}

export function bookPercent(book: ScoutResource, progress: BookProgress) {
    const total = bookChapterCount(book);
    const done = progress.completed.filter((index) => index < total).length;
    return Math.round((done / total) * 100);
}

export function reviewDueCount(now = new Date()): number {
    const storage = getStorage();
    const moment = now.getTime();
    return storage.getRoadmaps().reduce((count, roadmap) => {
        return count + storage.getReviews(roadmap.id).filter((item) => item.status !== "suggested" && item.status !== "skipped" && new Date(item.dueAt).getTime() <= moment).length;
    }, 0);
}

function weekStart(now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - (day - 1));
    return start;
}

interface WeekRecord {
    weekOf: string;
    sessionMs: number;
}

/**
 * Minutes watched and tasks completed since Monday. Session time is cumulative,
 * so the first visit of a week stores a baseline and later visits report the
 * difference; nothing is invented when there is no baseline yet.
 */
export function localWeeklyStats(now = new Date()): ScoutLocalStats {
    const storage = getStorage();
    const learning = storage.getLearningRecord();
    const start = weekStart(now);
    const weekOf = start.toISOString().slice(0, 10);

    const tasksCompleted = Object.entries(learning.tasksByDate).reduce((total, [date, count]) => {
        return date >= weekOf ? total + count : total;
    }, 0);

    const stored = read<WeekRecord>(WEEK_KEY);
    let minutesWatched = 0;

    if (!stored || stored.weekOf !== weekOf) {
        write(WEEK_KEY, { weekOf, sessionMs: learning.sessionTimeMs } satisfies WeekRecord);
    } else {
        minutesWatched = Math.max(0, Math.round((learning.sessionTimeMs - stored.sessionMs) / 60_000));
    }

    return {
        minutesWatched,
        tasksCompleted,
        reviewDue: reviewDueCount(now),
    };
}

/** Due review items across every local roadmap, newest schedule first. */
export function dueReviews(now = new Date()): SrsItem[] {
    const storage = getStorage();
    const moment = now.getTime();
    return storage
        .getRoadmaps()
        .flatMap((roadmap) => storage.getReviews(roadmap.id))
        .filter((item) => item.status !== "suggested" && item.status !== "skipped" && new Date(item.dueAt).getTime() <= moment)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
