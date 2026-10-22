import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { getYouTubeId } from "@/lib/video-utils";
import {
    assertScoutQuota,
    pauseScoutQuota,
    resolveScoutLlm,
    ScoutError,
} from "../llm";
import { assertFreeAi } from "@/lib/ai-policy";
import { z } from "zod";
import { isLikelyFree, type DiscoveredResource } from "./index";
import type { ScoutLlmConfig } from "../llm";

async function sourceUrl(value: string) {
    let url = new URL(value);
    for (
        let attempt = 0;
        attempt < 4 && url.hostname === "vertexaisearch.cloud.google.com";
        attempt += 1
    ) {
        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(10_000),
        });
        const target = response.headers.get("location");
        await response.body?.cancel();
        if (!target)
            throw new Error(
                "Search citation did not resolve to a source page.",
            );
        url = new URL(target, url);
    }
    if (url.hostname === "vertexaisearch.cloud.google.com")
        throw new Error("Search citation has too many redirects.");
    return url;
}

/** Only grounded source URLs become candidates; model-written links are ignored. */
export async function discoverFreeWeb(
    goal: string,
    limit: number,
    override?: ScoutLlmConfig | null,
): Promise<DiscoveredResource[]> {
    const config = resolveScoutLlm(override);
    if (!config.apiKey) return [];
    assertFreeAi(config.provider, config.model);
    assertScoutQuota();
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
    try {
        const result = await generateText({
            model: google("gemini-2.5-flash"),
            tools: { google_search: google.tools.googleSearch({}) },
            maxRetries: 0,
            prompt: `Find up to ${limit} specific free resources teaching this learning goal: ${goal}. Search across creators, official documentation, articles, and YouTube. Prefer substantial instructional material over news, reactions, paid courses, or resource directories. Cite the actual source pages. Creator preferences are guidance, never a restriction.`,
        });
        const candidates = await Promise.all(
            result.sources.map(
                async (source): Promise<DiscoveredResource[]> => {
                    if (
                        source.sourceType !== "url" ||
                        !isLikelyFree(source.url)
                    )
                        return [];
                    try {
                        const url = await sourceUrl(source.url);
                        if (
                            url.protocol !== "https:" ||
                            /^(localhost|127\.|0\.|10\.|192\.168\.|\[::1\])/.test(
                                url.hostname,
                            )
                        )
                            return [];
                        if (!isLikelyFree(url.toString())) return [];
                        const videoId = getYouTubeId(url.toString());
                        return [
                            {
                                kind: videoId
                                    ? "video"
                                    : /(?:docs\.|developer\.|\/docs\/)/.test(
                                            url.toString(),
                                        )
                                      ? "doc"
                                      : "article",
                                source: "google-search",
                                url: url.toString(),
                                title: source.title || url.hostname,
                                externalId: videoId,
                                thumbnailUrl: videoId
                                    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                                    : null,
                            },
                        ];
                    } catch {
                        return [];
                    }
                },
            ),
        );
        return candidates.flat().slice(0, limit);
    } catch (error) {
        const status = z.object({ statusCode: z.number() }).safeParse(error);
        if (status.success && status.data.statusCode === 429) {
            pauseScoutQuota();
            throw new ScoutError(
                "quota",
                "The free Gemini quota is exhausted. Scout has paused. Try again later or add resources manually.",
            );
        }
        throw error;
    }
}
