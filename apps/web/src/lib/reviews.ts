import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { Roadmap, SrsItem } from "@/types";
import type { PersonalSnapshot } from "./personal/schema";
import {
    personalEntries,
    putPersonalEntry,
    removePersonalEntry,
} from "./personal/store";
import { getStorage } from "./storage";

const scheduler = fsrs({ enable_fuzz: false });
export const reviewRatings = [
    { value: Rating.Again, label: "Again" },
    { value: Rating.Hard, label: "Hard" },
    { value: Rating.Good, label: "Good" },
    { value: Rating.Easy, label: "Easy" },
] as const;

export function scheduleReview(
    item: SrsItem,
    rating: Grade,
    now = new Date(),
): SrsItem {
    const previous: Card = item.fsrs
        ? {
              ...item.fsrs,
              due: new Date(item.fsrs.due),
              last_review: item.fsrs.last_review
                  ? new Date(item.fsrs.last_review)
                  : undefined,
          }
        : { ...createEmptyCard(now), due: new Date(item.dueAt) };
    const { card } = scheduler.next(previous, now, rating);
    return {
        ...item,
        status: "kept",
        repetitions: card.reps,
        intervalDays: card.scheduled_days,
        dueAt: card.due.toISOString(),
        lastReviewedAt: now.toISOString(),
        fsrs: {
            ...card,
            due: card.due.toISOString(),
            last_review: card.last_review?.toISOString(),
        },
    };
}

export function saveReview(item: SrsItem) {
    putPersonalEntry({
        kind: "review",
        id: `review:${item.id}`,
        data: item,
        updatedAt: Date.now(),
        deleted: false,
    });
}

export function createReview({
    prompt,
    answer,
    roadmapId,
    source,
}: {
    prompt: string;
    answer: string;
    roadmapId: string;
    source: SrsItem["source"];
}): SrsItem {
    const item: SrsItem = {
        id: crypto.randomUUID(),
        roadmapId,
        prompt: prompt.trim(),
        answer: answer.trim(),
        status: "kept",
        dueAt: new Date().toISOString(),
        easeFactor: 2.5,
        repetitions: 0,
        intervalDays: 0,
        source,
    };
    saveReview(item);
    return item;
}

/** True for cards on the schedule: neither waiting for a decision nor skipped. */
export function isScheduled(item: SrsItem) {
    return item.status !== "suggested" && item.status !== "skipped";
}

export function isDue(item: SrsItem, now = Date.now()) {
    return isScheduled(item) && new Date(item.dueAt).getTime() <= now;
}

/**
 * Every review card on this device. Cards saved by older versions live with
 * their roadmap; a personal copy of the same card wins.
 */
export function collectReviews(
    roadmaps: readonly Roadmap[],
    records: PersonalSnapshot,
): SrsItem[] {
    const legacy = roadmaps.flatMap((roadmap) =>
        getStorage().getReviews(roadmap.id),
    );
    const personal = personalEntries(records, "review").map(
        (entry) => entry.data,
    );
    const deleted = new Set(
        Object.values(records).flatMap((entry) =>
            entry.kind === "review" && entry.deleted ? [entry.data.id] : [],
        ),
    );
    return [
        ...new Map(
            [...legacy, ...personal]
                .filter((item) => !deleted.has(item.id))
                .map((item) => [item.id, item]),
        ).values(),
    ];
}

/** Remove a card for good, including a copy kept with its roadmap. */
export function deleteReview(item: SrsItem) {
    const legacy = getStorage().getReviews(item.roadmapId);
    if (legacy.some((entry) => entry.id === item.id))
        getStorage().saveReviews(
            item.roadmapId,
            legacy.filter((entry) => entry.id !== item.id),
        );
    removePersonalEntry(`review:${item.id}`);
}

/** How long until a date, as "10m", "5h", "3d" or "2mo". */
export function formatInterval(dueAt: string, now = Date.now()) {
    const minutes = Math.max(
        1,
        Math.round((new Date(dueAt).getTime() - now) / 60_000),
    );
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
    const days = Math.round(minutes / (60 * 24));
    return days < 60 ? `${days}d` : `${Math.round(days / 30)}mo`;
}
