import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { SrsItem } from "@/types";
import { putPersonalEntry } from "./personal/store";

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
