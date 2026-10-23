/* ═══════════════════════════════════════════════════════════
   Video Utilities — YouTube / Vimeo ID extraction & embed URLs
   ═══════════════════════════════════════════════════════════ */

// Hoist regex to module level (vercel best practice: js-hoist-regexp)
const YOUTUBE_PATTERNS = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare ID
];

const VIMEO_PATTERNS = [
    /(?:vimeo\.com\/)(\d+)/,
    /(?:player\.vimeo\.com\/video\/)(\d+)/,
];

export function getYouTubeId(url: string): string | null {
    for (const pattern of YOUTUBE_PATTERNS) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

export function getVimeoId(url: string): string | null {
    for (const pattern of VIMEO_PATTERNS) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

export function detectPlatform(url: string): "youtube" | "vimeo" | "other" {
    if (getYouTubeId(url)) return "youtube";
    if (getVimeoId(url)) return "vimeo";
    return "other";
}

export function getEmbedUrl(url: string): string | null {
    const ytId = getYouTubeId(url);
    if (ytId) return `https://www.youtube.com/embed/${ytId}`;

    const vimeoId = getVimeoId(url);
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

    return null;
}

export function getVideoId(url: string): string {
    return getYouTubeId(url) ?? getVimeoId(url) ?? url;
}

export function getVideoStartSeconds(value: string): number {
    try {
        const url = new URL(value);
        const time = url.searchParams.get("t") || url.searchParams.get("start") || url.hash.replace(/^#t=/, "");
        if (/^\d+(?:\.\d+)?s?$/.test(time)) return Math.max(0, Math.floor(Number.parseFloat(time)));
        const hours = Number(time.match(/(\d+)h/)?.[1] ?? 0);
        const minutes = Number(time.match(/(\d+)m/)?.[1] ?? 0);
        const seconds = Number(time.match(/(\d+)s/)?.[1] ?? 0);
        return hours * 3600 + minutes * 60 + seconds;
    } catch { return 0; }
}
