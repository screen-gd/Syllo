import type { SrsItem } from "@/types";

export type SrsRating = "hard" | "okay" | "easy";

const DAY_MS = 24 * 60 * 60 * 1000;

export function applySrsReview(item: SrsItem, rating: SrsRating, reviewedAt = new Date()): SrsItem {
    const easeDelta = rating === "easy" ? 0.15 : rating === "hard" ? -0.2 : 0;
    const repetitions = rating === "hard" ? Math.max(1, item.repetitions) : item.repetitions + 1;

    let intervalDays = item.intervalDays;
    if (rating === "hard") {
        intervalDays = Math.max(1, Math.round(intervalDays * 0.6) || 1);
    } else if (repetitions <= 1) {
        intervalDays = 1;
    } else if (repetitions === 2) {
        intervalDays = 3;
    } else {
        intervalDays = Math.max(1, Math.round(item.intervalDays * (item.easeFactor + easeDelta)));
    }

    const easeFactor = Math.max(1.3, Number((item.easeFactor + easeDelta).toFixed(2)));
    const dueAt = new Date(reviewedAt.getTime() + intervalDays * DAY_MS).toISOString();

    return {
        ...item,
        repetitions,
        intervalDays,
        easeFactor,
        dueAt,
        lastReviewedAt: reviewedAt.toISOString(),
    };
}
