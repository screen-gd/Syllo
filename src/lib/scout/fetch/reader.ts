import { chunkText } from "../format";

export interface ReaderResult {
    status: "ok" | "unavailable";
    title: string | null;
    text: string;
    via: "jina" | "direct" | "none";
    error?: string;
}

function tidy(markdown: string) {
    return markdown
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")
        .replace(/^[ \t]*[-*+][ \t]+/gm, "- ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

function htmlToText(html: string) {
    const withoutHead = html
        .replace(/<head[\s\S]*?<\/head>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "");

    const text = withoutHead
        .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, "\n\n## $2\n\n")
        .replace(/<\/(p|div|li|tr|blockquote)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ");

    return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractTitle(markdown: string, html: string) {
    const mdTitle = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    if (mdTitle) return mdTitle;

    const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    return htmlTitle ? htmlTitle.replace(/\s+/g, " ") : null;
}

/** Jina Reader turns any article into clean markdown. Direct fetch is the fallback. */
export async function readArticle(url: string): Promise<ReaderResult> {
    const jinaKey = process.env.JINA_API_KEY?.trim();

    try {
        const response = await fetch(`https://r.jina.ai/${url}`, {
            headers: {
                accept: "text/plain",
                ...(jinaKey ? { authorization: `Bearer ${jinaKey}` } : {}),
            },
            signal: AbortSignal.timeout(60_000),
        });

        if (response.ok) {
            const body = await response.text();
            const text = tidy(body);
            if (text.length > 400) {
                return {
                    status: "ok",
                    title: extractTitle(body, ""),
                    text,
                    via: "jina",
                };
            }
        }
    } catch {
        // fall through to a direct fetch
    }

    try {
        const response = await fetch(url, {
            headers: { "user-agent": "SylloScout/1.0 (+https://syllo.app)" },
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
            return { status: "unavailable", title: null, text: "", via: "none", error: `HTTP ${response.status}` };
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return { status: "unavailable", title: null, text: "", via: "none", error: "Not a text page" };
        }

        const body = await response.text();
        const markdown = contentType.includes("text/plain") ? body : htmlToText(body);
        const text = tidy(markdown);
        if (text.length < 200) {
            return { status: "unavailable", title: null, text: "", via: "none", error: "Page had no readable text" };
        }

        return { status: "ok", title: extractTitle("", body), text, via: "direct" };
    } catch (error) {
        return {
            status: "unavailable",
            title: null,
            text: "",
            via: "none",
            error: error instanceof Error ? error.message : "Fetch failed",
        };
    }
}

/**
 * Long docs get summarised chunk by chunk. Three chunks is the ceiling for a
 * single resource so one 80-page guide cannot eat the whole monthly budget.
 */
export function readerChunks(text: string, maxChunks = 3) {
    return chunkText(text, 8000, 500).slice(0, maxChunks);
}
