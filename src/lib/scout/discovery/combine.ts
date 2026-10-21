import { listEnabledSources } from "../sources";
import { dedupeResources, isLikelyFree, type DiscoveredResource } from "./index";
import { discoverSitesRecent, discoverWebForGoal } from "./exa";
import { discoverYouTubeForGoal, discoverYouTubeRecent } from "./youtube";

/**
 * Discovery is intentionally conservative: it reads only the channels and
 * sites the learner enabled, plus an open-web query when an Exa key exists.
 * Books are never discovered, because a book is a reading task, not a file.
 */
export async function discoverForGoal(input: { goal: string; limit?: number }): Promise<DiscoveredResource[]> {
    const goal = input.goal.trim();
    const limit = Math.min(20, Math.max(4, input.limit ?? 12));

    const sources = listEnabledSources();
    const channels = sources
        .filter((source) => source.kind === "youtube_channel" || source.kind === "creator")
        .map((source) => source.value);
    const sites = sources.filter((source) => source.kind === "site").map((source) => source.value);

    const [videos, web] = await Promise.all([
        channels.length > 0
            ? discoverYouTubeForGoal({ goal, channels, limit: Math.ceil(limit * 0.7) }).catch((error) => {
                  console.warn("[scout] YouTube discovery failed:", error instanceof Error ? error.message : error);
                  return [] as DiscoveredResource[];
              })
            : Promise.resolve([] as DiscoveredResource[]),
        discoverWebForGoal({ goal, limit: Math.ceil(limit * 0.6), sites }).catch((error) => {
            console.warn("[scout] web discovery failed:", error instanceof Error ? error.message : error);
            return [] as DiscoveredResource[];
        }),
    ]);

    const clean = (items: DiscoveredResource[]) =>
        items.filter((item) => isLikelyFree(item.url) && !/#shorts/i.test(`${item.title} ${item.url}`));

    const videoPool = clean(videos);
    const webPool = clean(web);
    const maxVideos = Math.max(3, Math.ceil(limit * 0.7));

    const picked: DiscoveredResource[] = [];
    const seen = new Set<string>();
    const push = (item: DiscoveredResource) => {
        const key = item.url.split("#")[0].replace(/\/$/, "").toLowerCase();
        if (seen.has(key) || picked.length >= limit) return;
        seen.add(key);
        picked.push(item);
    };

    // Alternating keeps the pack from becoming ten videos or ten articles.
    const maxLength = Math.max(videoPool.length, webPool.length);
    for (let index = 0; index < maxLength; index += 1) {
        if (videoPool[index] && picked.filter((item) => item.kind === "video").length < maxVideos) {
            push(videoPool[index]);
        }
        if (webPool[index]) push(webPool[index]);
        if (picked.length >= limit) break;
    }

    for (const item of [...videoPool, ...webPool]) push(item);

    return picked;
}

/**
 * Nightly check. RSS and site search only: no LLM, so it still works when the
 * browser is closed and no per-pack key is available.
 */
export async function discoverNewFromSources(input: {
    goal: string;
    since: Date;
    limit?: number;
}): Promise<DiscoveredResource[]> {
    const limit = input.limit ?? 12;
    const sources = listEnabledSources();
    const channels = sources
        .filter((source) => source.kind === "youtube_channel" || source.kind === "creator")
        .map((source) => source.value);
    const sites = sources.filter((source) => source.kind === "site").map((source) => source.value);

    const [videos, web] = await Promise.all([
        channels.length > 0
            ? discoverYouTubeRecent({ channels, since: input.since, limit }).catch(() => [])
            : Promise.resolve([] as DiscoveredResource[]),
        discoverSitesRecent({ goal: input.goal, sites, limit: Math.ceil(limit / 2) }).catch(() => []),
    ]);

    return dedupeResources([...videos, ...web])
        .filter((item) => isLikelyFree(item.url))
        .filter((item) => !item.publishedAt || new Date(item.publishedAt) >= input.since)
        .slice(0, limit);
}
