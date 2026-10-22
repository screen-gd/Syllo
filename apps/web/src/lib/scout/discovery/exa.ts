import { isLikelyFree, type DiscoveredResource } from "./index";

interface ExaResult {
    title?: string;
    url?: string;
    publishedDate?: string | null;
    author?: string | null;
    text?: string | null;
    score?: number;
}

interface ExaResponse {
    results?: ExaResult[];
    error?: string;
}

export function getExaApiKey() {
    return process.env.EXA_API_KEY?.trim() || "";
}

function looksLikeBook(url: string) {
    return /(?:^|\/)(books?|ebooks?)\//i.test(url) || /\.epub$/i.test(url);
}

export async function searchExa(input: {
    query: string;
    limit: number;
    includeDomains?: string[];
}): Promise<DiscoveredResource[]> {
    const key = getExaApiKey();
    if (!key) return [];

    const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": key,
        },
        body: JSON.stringify({
            query: input.query,
            numResults: Math.min(20, Math.max(1, input.limit)),
            type: "auto",
            contents: { text: { maxCharacters: 4000 } },
            ...(input.includeDomains?.length ? { includeDomains: input.includeDomains } : {}),
        }),
        signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Exa ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as ExaResponse;
    if (payload.error) throw new Error(`Exa: ${payload.error}`);

    return (payload.results ?? [])
        .filter((result): result is ExaResult & { url: string } => Boolean(result.url))
        .filter((result) => isLikelyFree(result.url) && !looksLikeBook(result.url))
        .filter((result) => !/youtube\.com|youtu\.be/i.test(result.url))
        .map((result) => ({
            kind: /\.pdf(?:$|\?)/i.test(result.url) ? ("doc" as const) : ("article" as const),
            source: "exa",
            url: result.url,
            title: result.title?.trim() || result.url,
            creator: result.author ?? null,
            publishedAt: result.publishedDate ?? null,
            description: result.text ?? null,
        }));
}

/**
 * The web half of goal discovery. Exa's neural search finds free tutorials
 * and reference docs; the query asks for free material explicitly so paid
 * course aggregators do not dominate.
 */
export async function discoverWebForGoal(input: {
    goal: string;
    limit: number;
    sites: string[];
}): Promise<DiscoveredResource[]> {
    const queries = [
        `${input.goal} free tutorial guide`,
        `${input.goal} documentation reference`,
    ];

    const results: DiscoveredResource[] = [];
    for (const query of queries) {
        try {
            results.push(...(await searchExa({ query, limit: Math.ceil(input.limit / queries.length) })));
        } catch (error) {
            console.warn("[scout] Exa query failed:", error instanceof Error ? error.message : error);
        }
    }

    for (const site of input.sites.slice(0, 4)) {
        try {
            results.push(
                ...(await searchExa({
                    query: `${input.goal} site:${site}`,
                    limit: 5,
                    includeDomains: [site],
                })),
            );
        } catch {
            // A single site failure must not fail discovery.
        }
    }

    return results;
}

/** Nightly check: only look at the sites the user explicitly added. */
export async function discoverSitesRecent(input: { goal: string; sites: string[]; limit: number }) {
    const results: DiscoveredResource[] = [];
    for (const site of input.sites.slice(0, 6)) {
        try {
            results.push(...(await searchExa({ query: input.goal || "new guides", limit: 5, includeDomains: [site] })));
        } catch {
            // ignore
        }
    }
    return results.slice(0, input.limit);
}
