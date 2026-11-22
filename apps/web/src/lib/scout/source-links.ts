export type SourceLink =
    | { kind: "video"; videoId: string }
    | { kind: "playlist"; playlistId: string }
    | { kind: "channel"; value: string };

export const MAX_SOURCE_LINKS = 10;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{20,}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

function toYouTubeUrl(text: string): URL | null {
    for (const candidate of [text, `https://${text}`]) {
        try {
            const url = new URL(candidate);
            if (YOUTUBE_HOSTS.has(url.hostname)) return url;
        } catch {
            // Not a URL; the next form may still parse.
        }
    }
    return null;
}

/**
 * Turns one pasted line into a YouTube link Scout can list. Returns null for
 * anything that is not a video, playlist or channel link.
 */
export function parseSourceLink(line: string): SourceLink | null {
    const text = line.trim();
    if (!text) return null;

    const bareHandle = text.match(/^@([\w.-]+)$/);
    if (bareHandle) return { kind: "channel", value: `@${bareHandle[1]}` };
    if (CHANNEL_ID.test(text)) return { kind: "channel", value: text };

    const url = toYouTubeUrl(text);
    if (!url) return null;

    if (url.hostname === "youtu.be") {
        const id = url.pathname.slice(1).split("/")[0] ?? "";
        return VIDEO_ID.test(id) ? { kind: "video", videoId: id } : null;
    }

    const path = url.pathname;

    if (path === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return VIDEO_ID.test(id) ? { kind: "video", videoId: id } : null;
    }

    const prefixed = path.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    if (prefixed) return { kind: "video", videoId: prefixed[1] };

    if (path === "/playlist") {
        const id = url.searchParams.get("list");
        return id ? { kind: "playlist", playlistId: id } : null;
    }

    const channel = path.match(/^\/channel\/(UC[\w-]+)(?:\/|$)/);
    if (channel) return { kind: "channel", value: channel[1] };

    const handle = path.match(/^\/@([\w.-]+)(?:\/|$)/);
    if (handle) return { kind: "channel", value: `@${handle[1]}` };

    // /c/ and /user/ links are kept verbatim: the name is not a stable id, so
    // channel resolution needs the original URL to search for it.
    if (/^\/(?:c|user)\/[\w.-]+(?:\/|$)/.test(path)) return { kind: "channel", value: text };

    return null;
}

/**
 * Parses the pasted textarea contents: one link per line, blank lines dropped,
 * duplicates collapsed. Lines that do not parse come back in `invalid` so the
 * start endpoint can name them.
 */
export function parseSourceLinks(text: string): { links: SourceLink[]; invalid: string[] } {
    const links: SourceLink[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line) continue;

        const link = parseSourceLink(line);
        if (!link) {
            invalid.push(line);
            continue;
        }

        const key = JSON.stringify(link);
        if (seen.has(key)) continue;
        seen.add(key);
        links.push(link);
    }

    return { links, invalid };
}
