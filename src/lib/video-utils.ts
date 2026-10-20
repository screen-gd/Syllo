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
