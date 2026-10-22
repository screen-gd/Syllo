/** Shared shape every discovery provider returns. */
export interface DiscoveredResource {
    kind: "video" | "article" | "doc" | "book";
    source: string;
    externalId?: string | null;
    url: string;
    title: string;
    creator?: string | null;
    durationSeconds?: number | null;
    publishedAt?: string | null;
    thumbnailUrl?: string | null;
    description?: string | null;
}

export interface DiscoveryProvider {
    name: string;
    discover(input: { goal: string; limit: number }): Promise<DiscoveredResource[]>;
}

const PAID_HOSTS = [
    "udemy.com",
    "coursera.org",
    "skillshare.com",
    "pluralsight.com",
    "linkedin.com/learning",
    "masterclass.com",
    "frontendmasters.com",
    "egghead.io",
    "oreilly.com",
    "packtpub.com",
    "manning.com",
];

/** Keeps discovery on free material; books are added by hand and never fetched. */
export function isLikelyFree(url: string): boolean {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        const full = `${host}${parsed.pathname}`;

        if (PAID_HOSTS.some((paid) => full.startsWith(paid) || full.includes(`.${paid}`))) {
            // Udemy has a genuinely free filter; anything else on a paid host is out.
            return host === "udemy.com" && parsed.searchParams.get("price") === "price-free";
        }

        return true;
    } catch {
        return false;
    }
}

export function dedupeResources(items: DiscoveredResource[]): DiscoveredResource[] {
    const seen = new Set<string>();
    const result: DiscoveredResource[] = [];
    for (const item of items) {
        const key = canonicalResourceUrl(item.url);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}

export function canonicalResourceUrl(value: string) {
    try {
        const url = new URL(value);
        const video = /(?:^|\.)youtube\.com$/.test(url.hostname) ? url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1] : url.hostname === "youtu.be" ? url.pathname.slice(1) : null;
        if (video) return `https://www.youtube.com/watch?v=${video}`;
        url.hash = "";
        for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
        return url.toString().replace(/\/$/, "");
    } catch { return value; }
}

/** Cheap lexical score used only to order candidates before the LLM ranks them. */
export function goalScore(goal: string, text: string): number {
    const tokens = new Set(
        goal
            .toLowerCase()
            .replace(/[^a-z0-9\s+#.-]/g, " ")
            .split(/\s+/)
            .filter((token) => token.length > 2),
    );
    if (tokens.size === 0) return 0;

    const haystack = text.toLowerCase();
    let score = 0;
    for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
    }
    return score;
}
