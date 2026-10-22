/** Pure helpers for timestamps, durations, chapter parsing and quote checks. */

export interface ParsedChapter {
    startSeconds: number;
    title: string;
}

/** "1:23", "01:02:03" and "0:00" all become seconds. Returns null otherwise. */
export function parseTimestamp(value: string): number | null {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const first = Number(match[1]);
    const second = Number(match[2]);
    const third = match[3] === undefined ? null : Number(match[3]);

    if (second > 59 || (third !== null && third > 59)) return null;
    return third === null ? first * 60 + second : first * 3600 + second * 60 + third;
}

export function formatTimestamp(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function deepLink(videoId: string, startSeconds?: number | null): string {
    const base = `https://youtu.be/${videoId}`;
    if (startSeconds === undefined || startSeconds === null || startSeconds <= 0) return base;
    return `${base}?t=${Math.floor(startSeconds)}`;
}

/**
 * Pulls chapter headings out of a YouTube description.
 *
 * Accepts the shapes creators actually use: "00:00 Intro", "0:00 - Intro",
 * "(12:30) Demo" and "1:02:03 Deep dive".
 */
export function parseDescriptionChapters(description: string | null | undefined): ParsedChapter[] {
    if (!description) return [];

    const chapters: ParsedChapter[] = [];
    for (const rawLine of description.split(/\r?\n/)) {
        const line = rawLine.trim().replace(/^[-*•]\s*/, "");
        const match = line.match(/^\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[-–—:.)]?\s*(.+)$/);
        if (!match) continue;

        const startSeconds = parseTimestamp(match[1]);
        const title = match[2].trim();
        if (startSeconds === null || title.length < 2) continue;
        if (chapters.some((chapter) => chapter.startSeconds === startSeconds)) continue;
        chapters.push({ startSeconds, title: title.slice(0, 120) });
    }

    return chapters.sort((left, right) => left.startSeconds - right.startSeconds);
}

/** ISO-8601 duration ("PT1H2M10S") to seconds. */
export function parseIsoDuration(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!match) return null;
    const [, days, hours, minutes, seconds] = match;
    const total = Number(days ?? 0) * 86400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
    return total > 0 ? total : null;
}

export function humanDuration(totalSeconds: number | null | undefined): string {
    if (!totalSeconds || totalSeconds <= 0) return "—";
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Lowercase, collapse whitespace and strip punctuation so quotes can be matched. */
export function normalizeForMatch(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9' ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * True when the quote really appears in the source text. Short quotes are
 * rejected because they match almost anything.
 */
export function quoteAppearsIn(quote: string, source: string): boolean {
    const needle = normalizeForMatch(quote);
    if (needle.length < 12) return false;
    return normalizeForMatch(source).includes(needle);
}

/** Split long text into overlapping chunks for summarisation. */
export function chunkText(text: string, size = 6000, overlap = 400): string[] {
    const clean = text.trim();
    if (!clean) return [];
    if (clean.length <= size) return [clean];

    const chunks: string[] = [];
    let start = 0;
    while (start < clean.length && chunks.length < 12) {
        const end = Math.min(clean.length, start + size);
        let slice = clean.slice(start, end);

        // Prefer to cut at a paragraph boundary near the end of the window.
        if (end < clean.length) {
            const boundary = slice.lastIndexOf("\n\n");
            if (boundary > size * 0.6) slice = slice.slice(0, boundary);
        }

        chunks.push(slice.trim());
        const advance = Math.max(1, slice.length - overlap);
        start += advance;
    }

    return chunks.filter(Boolean);
}

export function clip(value: string, limit: number): string {
    const clean = value.replace(/\s+/g, " ").trim();
    return clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
