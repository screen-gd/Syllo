import { countResourcesSince, listLibrary } from "./library";
import type { ScoutDigest } from "./types";

/**
 * Weekly digest. The server knows how many resources arrived and which ones
 * are worth a look. Minutes watched, tasks completed and review-due live in
 * the learner's browser, so the client merges those into this shape.
 */
export function buildDigest(now = new Date()): ScoutDigest {
    const weekStart = new Date(now.getTime() - 7 * 24 * 3600_000);
    const since = weekStart.toISOString();
    const newResources = countResourcesSince(since);

    const highlights = listLibrary({ since, limit: 4 }).map((resource) => ({
        title: resource.title,
        url: resource.url,
        skill: resource.skillTags[0],
    }));

    const headline =
        newResources === 0
            ? "No new free resources this week yet. Scout checks again tonight."
            : `${newResources} new free resource${newResources === 1 ? "" : "s"} arrived this week.`;

    return {
        weekOf: since.slice(0, 10),
        newResources,
        minutesWatched: 0,
        tasksCompleted: 0,
        reviewDue: 0,
        headline,
        highlights,
    };
}
