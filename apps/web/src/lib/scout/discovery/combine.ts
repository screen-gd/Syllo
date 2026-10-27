import { listEnabledSources } from "../sources";
import { canonicalResourceUrl, dedupeResources, isLikelyFree, type DiscoveredResource } from "./index";
import { discoverYouTubeForGoal, discoverYouTubeRecent } from "./youtube";
import { discoverYouTubeSearch } from "./youtube";
import { discoverFreeWeb } from "./free-web";
import { ScoutError, type ScoutLlmConfig } from "../llm";

/**
 * Broad search supplies candidates; enabled creators are preferences.
 * Imported books stay in Library and do not need web discovery.
 */
export async function discoverForGoal(input: { goal: string; limit?: number; llm?: ScoutLlmConfig | null }): Promise<DiscoveredResource[]> {
    const goal = input.goal.trim();
    const limit = Math.min(20, Math.max(4, input.limit ?? 12));

    const sources = listEnabledSources();
    const channels = sources
        .filter((source) => source.kind === "youtube_channel" || source.kind === "creator")
        .map((source) => source.value);

    const [preferredVideos, broadVideos, web] = await Promise.all([
        channels.length > 0
            ? discoverYouTubeForGoal({ goal, channels, limit: Math.ceil(limit * 0.7) }).catch((error) => {
                  console.warn("[scout] YouTube discovery failed:", error instanceof Error ? error.message : error);
                  return [] as DiscoveredResource[];
              })
            : Promise.resolve([] as DiscoveredResource[]),
        discoverYouTubeSearch(goal, Math.ceil(limit * 0.7)).catch(() => []),
        discoverFreeWeb(goal, Math.ceil(limit * 0.7), input.llm).catch((error) => {
            if (error instanceof ScoutError) throw error;
            console.warn("[scout] web discovery failed:", error instanceof Error ? error.message : error);
            return [] as DiscoveredResource[];
        }),
    ]);

    const clean = (items: DiscoveredResource[]) =>
        items.filter((item) => isLikelyFree(item.url) && !/#shorts/i.test(`${item.title} ${item.url}`));

    const videoPool = clean(dedupeResources([...broadVideos, ...web.filter(item => item.kind === "video"), ...preferredVideos]));
    const webPool = clean(web.filter(item => item.kind !== "video"));

    return pickVideoFirst({ videos: videoPool, web: webPool, limit });
}

/**
 * The pack is a video ladder, so videos come first. Articles and docs fill a
 * small tail once the pack has enough videos; when videos are scarce they may
 * take the rest of the slots.
 */
export function pickVideoFirst(input: {
    videos: DiscoveredResource[];
    web: DiscoveredResource[];
    limit: number;
}): DiscoveredResource[] {
    const limit = Math.max(0, Math.floor(input.limit));
    const seen = new Set<string>();
    const picked: DiscoveredResource[] = [];

    const push = (item: DiscoveredResource): boolean => {
        const key = canonicalResourceUrl(item.url);
        if (seen.has(key) || picked.length >= limit) return false;
        seen.add(key);
        picked.push(item);
        return true;
    };

    for (const video of dedupeResources(input.videos)) {
        if (picked.length >= limit) break;
        push(video);
    }

    const videoCount = picked.length;
    const webCap = videoCount >= 3 ? Math.max(1, Math.floor(limit * 0.25)) : limit;
    for (const item of dedupeResources(input.web)) {
        if (picked.length >= limit || picked.length - videoCount >= webCap) break;
        push(item);
    }

    return picked;
}

/**
 * Optional creator check uses free RSS while the local worker is running.
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
    const videos = channels.length > 0
        ? await discoverYouTubeRecent({ channels, since: input.since, limit }).catch(() => [])
        : [];

    return dedupeResources(videos)
        .filter((item) => isLikelyFree(item.url))
        .filter((item) => !item.publishedAt || new Date(item.publishedAt) >= input.since)
        .slice(0, limit);
}
