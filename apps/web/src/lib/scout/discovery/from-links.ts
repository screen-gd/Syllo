import { z } from "zod";
import { ScoutError, scoutGenerateObject, type ScoutLlmConfig } from "../llm";
import type { SourceLink } from "../source-links";
import { canonicalResourceUrl, dedupeResources, goalScore, isLikelyFree, type DiscoveredResource } from "./index";
import { listLinkVideos } from "./youtube";

export const LINK_PACK_LIMIT = 20;

const PICK_SCHEMA = z.object({ picks: z.array(z.number().int()) });
const PROMPT_POOL_CAP = 300;

/**
 * Pure selection, exported for tests. Pinned videos always lead the pack and
 * are never re-ranked; `rank` only picks which pool videos fill the leftover
 * slots when the pool does not fit on its own.
 */
export async function selectLinkVideos(input: {
    pinned: DiscoveredResource[];
    pool: DiscoveredResource[];
    limit: number;
    rank: (pool: DiscoveredResource[], slots: number) => Promise<DiscoveredResource[]>;
}): Promise<DiscoveredResource[]> {
    const pinned = dedupeResources(input.pinned).slice(0, input.limit);
    const pinnedKeys = new Set(pinned.map((item) => canonicalResourceUrl(item.url)));

    // Pinned wins over pool: a video the learner pasted explicitly keeps its
    // spot even when a channel or playlist lists it again.
    const pool = dedupeResources(input.pool).filter((item) => !pinnedKeys.has(canonicalResourceUrl(item.url)));

    const slots = input.limit - pinned.length;
    if (slots <= 0) return pinned;
    if (pool.length <= slots) return [...pinned, ...pool];

    const poolKeys = new Set(pool.map((item) => canonicalResourceUrl(item.url)));
    const seen = new Set(pinnedKeys);
    const extra: DiscoveredResource[] = [];
    for (const item of await input.rank(pool, slots)) {
        const key = canonicalResourceUrl(item.url);
        if (!poolKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        extra.push(item);
        if (extra.length >= slots) break;
    }
    return [...pinned, ...extra];
}

function linkLabel(link: SourceLink): string {
    switch (link.kind) {
        case "video":
            return link.videoId;
        case "playlist":
            return link.playlistId;
        case "channel":
            return link.value;
    }
}

async function rankLinkPool(input: {
    goal: string;
    pool: DiscoveredResource[];
    slots: number;
    packId: string;
    llm?: ScoutLlmConfig | null;
}): Promise<DiscoveredResource[]> {
    const pool = input.pool.slice(0, PROMPT_POOL_CAP);
    const lines = pool
        .map(
            (item, index) =>
                `${index + 1}. ${item.title} | ${item.creator ?? "unknown"} | ${item.durationSeconds ? Math.round(item.durationSeconds / 60) : "?"}`,
        )
        .join("\n");

    try {
        const result = await scoutGenerateObject({
            packId: input.packId,
            config: input.llm,
            schema: PICK_SCHEMA,
            system: "You choose which videos a learner should watch. Reply only with the numbers of the chosen videos.",
            prompt: `Learning goal:
${input.goal}

Videos (number. title | channel | minutes):
${lines}

Choose up to ${input.slots} videos that teach this goal most directly. Prefer explanations and tutorials over news, reactions and drama. When two videos cover the same thing, prefer the newer one. If fewer than ${input.slots} videos fit the goal, return fewer. Return their numbers in the order a beginner should watch them.`,
        });

        const picks = result.object.picks
            .map((number) => pool[number - 1])
            .filter((item): item is DiscoveredResource => Boolean(item));
        if (picks.length > 0) return picks;
    } catch (error) {
        if (error instanceof ScoutError && (error.code === "quota" || error.code === "config" || error.code === "budget")) {
            throw error;
        }
        console.warn("[scout] link ranking failed:", error instanceof Error ? error.message : error);
    }

    return [...pool]
        .map((item) => ({ item, score: goalScore(input.goal, `${item.title} ${item.description ?? ""}`) }))
        .sort((left, right) => right.score - left.score || (right.item.publishedAt ?? "").localeCompare(left.item.publishedAt ?? ""))
        .slice(0, input.slots)
        .map((entry) => entry.item);
}

/**
 * Discovery for a pack started from pasted links: each link is listed in turn
 * and one bad link only warns, it does not sink the pack. Single videos are
 * pinned; playlist and channel listings compete for the remaining slots.
 */
export async function discoverFromLinks(input: {
    goal: string;
    links: SourceLink[];
    packId: string;
    llm?: ScoutLlmConfig | null;
}): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    const pinned: DiscoveredResource[] = [];
    const pool: DiscoveredResource[] = [];
    let feedOnly = false;

    for (const link of input.links) {
        try {
            const listed = await listLinkVideos(link);
            feedOnly = feedOnly || listed.feedOnly;
            if (link.kind === "video") pinned.push(...listed.videos);
            else pool.push(...listed.videos);
        } catch (error) {
            if (error instanceof ScoutError) throw error;
            console.warn(`[scout] link ${linkLabel(link)} failed:`, error instanceof Error ? error.message : error);
        }
    }

    const videos = await selectLinkVideos({
        pinned: pinned.filter((item) => isLikelyFree(item.url)),
        pool: pool.filter((item) => isLikelyFree(item.url)),
        limit: LINK_PACK_LIMIT,
        rank: (rankPool, slots) => rankLinkPool({ goal: input.goal, pool: rankPool, slots, packId: input.packId, llm: input.llm }),
    });

    return { videos, feedOnly };
}
