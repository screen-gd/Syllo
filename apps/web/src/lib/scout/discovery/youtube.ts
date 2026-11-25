import { getScoutDb, nowIso } from "../db";
import { parseIsoDuration } from "../format";
import { dedupeResources, goalScore, type DiscoveredResource } from "./index";
import { ScoutError } from "../llm";
import { SOURCE_COPY } from "../source-copy";
import type { SourceLink } from "../source-links";
import { z } from "zod";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

interface YouTubeChannelResponse {
    items?: Array<{
        id: string;
        snippet?: { title?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
}

interface PlaylistItemsResponse {
    items?: Array<{
        contentDetails?: { videoId?: string };
        snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            channelTitle?: string;
            thumbnails?: { medium?: { url?: string } };
        };
    }>;
    nextPageToken?: string;
}

interface VideosResponse {
    items?: Array<{
        id: string;
        snippet?: {
            title?: string;
            description?: string;
            publishedAt?: string;
            channelTitle?: string;
            thumbnails?: { medium?: { url?: string } };
        };
        contentDetails?: { duration?: string };
    }>;
}

export function getYouTubeApiKey() {
    return process.env.YOUTUBE_API_KEY?.trim() || "";
}

/** Saved creators are preferences; goal search can find any channel. */
export async function discoverYouTubeSearch(goal: string, limit: number): Promise<DiscoveredResource[]> {
    if (!getYouTubeApiKey()) return [];
    const response = await youtubeFetch<unknown>("search", { part: "snippet", q: goal, type: "video", maxResults: String(Math.min(15, limit)), videoDuration: "medium", relevanceLanguage: "en", order: "relevance" });
    const parsed = z.object({ items: z.array(z.object({ id: z.object({ videoId: z.string() }) })).default([]) }).parse(response);
    const videos = await fetchVideos(parsed.items.map(item => item.id.videoId));
    return videos.map(toVideo).filter(video => !video.durationSeconds || video.durationSeconds >= MIN_VIDEO_SECONDS);
}

async function youtubeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
    const key = getYouTubeApiKey();
    if (!key) throw new Error("YOUTUBE_API_KEY is not configured");

    const url = new URL(`${API_ROOT}/${path}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    url.searchParams.set("key", key);

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        if (
            (response.status === 400 || response.status === 401 || response.status === 403) &&
            /API key not valid|API keys are not supported|API_KEY_INVALID/i.test(body)
        ) {
            // A wrong or malformed key is a configuration fault, not a quota
            // or network problem; the caller must be told to fix the key.
            throw new ScoutError("config", SOURCE_COPY.badYouTubeKey);
        }
        if (response.status === 403) {
            throw new Error(`YouTube API quota or permission error: ${body.slice(0, 200)}`);
        }
        throw new Error(`YouTube API ${response.status}: ${body.slice(0, 200)}`);
    }

    return (await response.json()) as T;
}

interface ChannelInfo {
    channelId: string;
    uploadsPlaylistId: string;
    title: string;
}

/** Resolves an @handle, a channel URL or a raw UC id into its uploads playlist. */
export async function resolveChannel(value: string): Promise<ChannelInfo | null> {
    const clean = value.trim();
    if (!clean) return null;

    const byUrl = clean.match(/youtube\.com\/channel\/(UC[\w-]+)/i)?.[1];
    const rawId = byUrl ?? (clean.startsWith("UC") ? clean : null);

    const params: Record<string, string> = { part: "contentDetails,snippet", maxResults: "1" };
    if (rawId) params.id = rawId;
    else params.forHandle = clean.startsWith("@") ? clean : `@${clean}`;

    const payload = await youtubeFetch<YouTubeChannelResponse>("channels", params);
    const item = payload.items?.[0];
    const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!item || !uploadsPlaylistId) return null;

    getScoutDb()
        .prepare(
            `INSERT INTO channel_cache (channel_id, uploads_playlist_id, checked_at) VALUES (?, ?, ?)
             ON CONFLICT(channel_id) DO UPDATE SET uploads_playlist_id = excluded.uploads_playlist_id, checked_at = excluded.checked_at`,
        )
        .run(item.id, uploadsPlaylistId, nowIso());

    return { channelId: item.id, uploadsPlaylistId, title: item.snippet?.title ?? clean };
}

async function cachedChannel(value: string): Promise<ChannelInfo | null> {
    const db = getScoutDb();
    const directId = value.match(/^UC[\w-]+$/)?.[0];
    if (directId) {
        const cached = db
            .prepare(`SELECT channel_id, uploads_playlist_id, checked_at FROM channel_cache WHERE channel_id = ?`)
            .get(directId) as { channel_id: string; uploads_playlist_id: string; checked_at: string } | undefined;

        if (cached && Date.now() - new Date(cached.checked_at).getTime() < 7 * 24 * 3600_000) {
            return { channelId: cached.channel_id, uploadsPlaylistId: cached.uploads_playlist_id, title: directId };
        }
    }

    return resolveChannel(value);
}

async function listUploads(
    playlistId: string,
    maxResults = 25,
): Promise<NonNullable<PlaylistItemsResponse["items"]>> {
    const payload = await youtubeFetch<PlaylistItemsResponse>("playlistItems", {
        part: "snippet,contentDetails",
        playlistId,
        maxResults: String(Math.min(50, maxResults)),
    });
    return payload.items ?? [];
}

async function fetchVideos(ids: string[]): Promise<NonNullable<VideosResponse["items"]>> {
    const items: NonNullable<VideosResponse["items"]> = [];
    for (let start = 0; start < ids.length; start += 50) {
        const payload = await youtubeFetch<VideosResponse>("videos", {
            part: "snippet,contentDetails",
            id: ids.slice(start, start + 50).join(","),
            maxResults: "50",
        });
        items.push(...(payload.items ?? []));
    }
    return items;
}

function toVideo(item: NonNullable<VideosResponse["items"]>[number]): DiscoveredResource {
    const duration = parseIsoDuration(item.contentDetails?.duration);
    return {
        kind: "video",
        source: "youtube",
        externalId: item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: item.snippet?.title ?? "Untitled video",
        creator: item.snippet?.channelTitle ?? null,
        durationSeconds: duration,
        publishedAt: item.snippet?.publishedAt ?? null,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
        description: item.snippet?.description ?? null,
    };
}

const MIN_VIDEO_SECONDS = 3 * 60;
const MAX_VIDEO_SECONDS = 3 * 3600;

/**
 * Goal discovery through the Data API: channels.list -> playlistItems.list ->
 * videos.list. search.list is never called because it costs 100 quota units
 * per request and returns less structured data.
 */
export async function discoverYouTubeForGoal(input: {
    goal: string;
    channels: string[];
    limit: number;
}): Promise<DiscoveredResource[]> {
    // Without a Data API key the RSS feed still gives titles, descriptions and
    // publish dates. That is enough to rank candidates; durations arrive when
    // the transcript is fetched.
    if (!getYouTubeApiKey()) return discoverYouTubeFromFeeds(input);

    const candidates: DiscoveredResource[] = [];

    for (const channel of input.channels.slice(0, 5)) {
        try {
            const info = await cachedChannel(channel);
            if (!info) continue;

            const uploads = await listUploads(info.uploadsPlaylistId, 25);
            const ids = uploads.map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
            const videos = await fetchVideos(ids);
            for (const video of videos) candidates.push(toVideo(video));
        } catch (error) {
            console.warn(`[scout] YouTube channel ${channel} failed:`, error instanceof Error ? error.message : error);
        }
    }

    const filtered = candidates.filter(
        (item) => (item.durationSeconds ?? 0) >= MIN_VIDEO_SECONDS && (item.durationSeconds ?? 0) <= MAX_VIDEO_SECONDS,
    );

    return dedupeResources(filtered)
        .map((item) => ({ item, score: goalScore(input.goal, `${item.title} ${item.description ?? ""}`) }))
        .sort((left, right) => right.score - left.score || (right.item.publishedAt ?? "").localeCompare(left.item.publishedAt ?? ""))
        .slice(0, input.limit)
        .map((entry) => entry.item);
}

const handleCache = new Map<string, string | null>();

/**
 * Pulls the page owner's channel id out of channel page HTML. The canonical
 * link and the feed URL name the channel itself; a bare "channelId" can be any
 * channel YouTube mentions on the page, so it stays the last resort.
 */
export function channelIdFromHtml(html: string): string | null {
    return (
        html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})"/)?.[1] ??
        html.match(/"externalId":"(UC[\w-]{20,})"/)?.[1] ??
        html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{20,})/)?.[1] ??
        html.match(/"channelId":"(UC[\w-]{20,})"/)?.[1] ??
        html.match(/channel\/(UC[\w-]{20,})/)?.[1] ??
        null
    );
}

/**
 * Public channel pages expose their id in the HTML. This keeps goal discovery
 * working when no YOUTUBE_API_KEY is configured; it is one request per handle
 * and cached for the life of the process.
 */
export async function resolveChannelIdWithoutKey(value: string): Promise<string | null> {
    const clean = value.trim();
    if (!clean) return null;

    const direct = clean.match(/(?:channel\/)?(UC[\w-]{20,})/)?.[1];
    if (direct) return direct;

    const handle =
        clean.match(/youtube\.com\/@([\w.-]+)/i)?.[1] ??
        clean.match(/youtube\.com\/c\/([\w.-]+)/i)?.[1] ??
        clean.replace(/^@/, "").match(/^[\w.-]+$/)?.[0];

    if (!handle) return null;
    if (handleCache.has(handle)) return handleCache.get(handle) ?? null;

    try {
        const response = await fetch(`https://www.youtube.com/@${handle}`, {
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
                "accept-language": "en-US,en;q=0.8",
            },
            signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
            handleCache.set(handle, null);
            return null;
        }

        const html = await response.text();
        const channelId = channelIdFromHtml(html);

        handleCache.set(handle, channelId);
        return channelId;
    } catch {
        handleCache.set(handle, null);
        return null;
    }
}

/** Keyless goal discovery: channel page scrape first, 15-item feed as fallback. */
export async function discoverYouTubeFromFeeds(input: {
    goal: string;
    channels: string[];
    limit: number;
}): Promise<DiscoveredResource[]> {
    const candidates: DiscoveredResource[] = [];

    for (const channel of input.channels.slice(0, 6)) {
        try {
            const scraped = await listChannelVideosFromPage(channel);
            if (scraped.videos.length > 0) {
                candidates.push(...scraped.videos.filter(isWithinDurationRange));
                continue;
            }
            const channelId = scraped.channelId ?? (await resolveChannelIdWithoutKey(channel));
            if (!channelId) continue;

            const feed = await fetchChannelFeed(channelId);
            candidates.push(...feed);
        } catch (error) {
            console.warn(`[scout] YouTube feed ${channel} failed:`, error instanceof Error ? error.message : error);
        }
    }

    return dedupeResources(candidates)
        .map((item) => ({ item, score: goalScore(input.goal, `${item.title} ${item.description ?? ""}`) }))
        .sort((left, right) => right.score - left.score || (right.item.publishedAt ?? "").localeCompare(left.item.publishedAt ?? ""))
        .slice(0, input.limit)
        .map((entry) => entry.item);
}

/** Watch pages carry lengthSeconds; used to fill the gap left by RSS. */
export async function fetchVideoDuration(videoId: string): Promise<number | null> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
            headers: { "user-agent": "Mozilla/5.0 (compatible; SylloScout/1.0)" },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return null;
        const html = await response.text();
        const match = html.match(/"lengthSeconds":"(\d+)"/) ?? html.match(/"approxDurationMs":"(\d+)"/);
        if (!match) return null;
        const value = Number(match[1]);
        if (!Number.isFinite(value) || value <= 0) return null;
        return match[0].includes("approxDurationMs") ? Math.round(value / 1000) : value;
    } catch {
        return null;
    }
}

function decodeXml(value: string) {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
}

function tag(entry: string, name: string): string | null {
    const match = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    return match ? decodeXml(match[1]) : null;
}

/** Parses a YouTube channel RSS feed without a dependency. */
export function parseYouTubeFeed(xml: string): DiscoveredResource[] {
    const items: DiscoveredResource[] = [];

    for (const entry of xml.split(/<entry>/i).slice(1)) {
        const videoId = tag(entry, "yt:videoId");
        if (!videoId) continue;

        const description = tag(entry, "media:description");
        const thumbnail = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ?? null;

        items.push({
            kind: "video",
            source: "youtube-rss",
            externalId: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            title: tag(entry, "title") ?? "Untitled video",
            creator: tag(entry, "name") ?? null,
            publishedAt: tag(entry, "published") ?? null,
            thumbnailUrl: thumbnail,
            description,
        });
    }

    return items;
}

export async function fetchChannelFeed(channelId: string): Promise<DiscoveredResource[]> {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return [];
    return parseYouTubeFeed(await response.text());
}

/**
 * RSS path for the nightly check. It needs no API key, so auto-check keeps
 * working for a user who never configured YouTube credentials.
 */
export async function discoverYouTubeRecent(input: {
    channels: string[];
    since: Date;
    limit: number;
}): Promise<DiscoveredResource[]> {
    const items: DiscoveredResource[] = [];

    for (const channel of input.channels.slice(0, 8)) {
        try {
            const info = getYouTubeApiKey() ? await cachedChannel(channel) : null;
            const channelId =
                info?.channelId ?? channel.match(/^UC[\w-]+$/)?.[0] ?? (await resolveChannelIdWithoutKey(channel));
            if (!channelId) continue;

            const feed = await fetchChannelFeed(channelId);
            items.push(...feed.filter((item) => !item.publishedAt || new Date(item.publishedAt) >= input.since));
        } catch (error) {
            console.warn(`[scout] RSS feed for ${channel} failed:`, error instanceof Error ? error.message : error);
        }
    }

    const deduped = dedupeResources(items);

    // Enrich durations when the API key is available; RSS does not carry them.
    if (getYouTubeApiKey()) {
        const ids = deduped.map((item) => item.externalId).filter((id): id is string => Boolean(id));
        try {
            const videos = await fetchVideos(ids);
            const durations = new Map(videos.map((video) => [video.id, parseIsoDuration(video.contentDetails?.duration)]));
            for (const item of deduped) {
                item.durationSeconds = durations.get(item.externalId ?? "") ?? null;
            }
        } catch (error) {
            console.warn("[scout] duration enrichment failed:", error instanceof Error ? error.message : error);
        }
    }

    return deduped.slice(0, input.limit);
}

/* ------------------------------------------------------------------ *
 * Listing videos behind pasted links
 * ------------------------------------------------------------------ */

const LINK_LIST_LIMIT = 200;

async function listVideoById(videoId: string): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    if (getYouTubeApiKey()) {
        const items = await fetchVideos([videoId]);
        return { videos: items.map(toVideo), feedOnly: false };
    }

    // oEmbed is keyless; a video that is private or gone simply lists nothing.
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return { videos: [], feedOnly: false };
        const data = z
            .object({
                title: z.string(),
                author_name: z.string().optional(),
                thumbnail_url: z.string().optional(),
            })
            .parse(await response.json());
        return {
            videos: [
                {
                    kind: "video",
                    source: "youtube-oembed",
                    externalId: videoId,
                    url,
                    title: data.title,
                    creator: data.author_name ?? null,
                    thumbnailUrl: data.thumbnail_url ?? null,
                },
            ],
            feedOnly: false,
        };
    } catch {
        return { videos: [], feedOnly: false };
    }
}

async function listPlaylistVideoIds(playlistId: string, limit = LINK_LIST_LIMIT): Promise<string[]> {
    const ids: string[] = [];
    let pageToken = "";
    while (ids.length < limit) {
        const params: Record<string, string> = {
            part: "contentDetails",
            playlistId,
            maxResults: String(Math.min(50, limit - ids.length)),
        };
        if (pageToken) params.pageToken = pageToken;

        const payload = await youtubeFetch<PlaylistItemsResponse>("playlistItems", params);
        for (const item of payload.items ?? []) {
            const id = item.contentDetails?.videoId;
            if (id) ids.push(id);
        }
        pageToken = payload.nextPageToken ?? "";
        if (!pageToken) break;
    }
    return ids;
}

async function fetchVideosInOrder(ids: string[]): Promise<DiscoveredResource[]> {
    const byId = new Map((await fetchVideos(ids)).map((item) => [item.id, item]));
    const seen = new Set<string>();
    const videos: DiscoveredResource[] = [];
    for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const item = byId.get(id);
        if (item) videos.push(toVideo(item));
    }
    return videos;
}

async function listPlaylistVideos(playlistId: string): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    if (!getYouTubeApiKey()) {
        // The playlist page lists the whole list; the playlist feed (15 items)
        // stays the fallback when the scrape comes back empty.
        const scraped = await listPlaylistVideosFromPage(playlistId);
        if (scraped.length > 0) return { videos: scraped.filter(isWithinDurationRange), feedOnly: false };

        const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`, {
            signal: AbortSignal.timeout(15_000),
        });
        return { videos: response.ok ? parseYouTubeFeed(await response.text()) : [], feedOnly: true };
    }

    const ids = await listPlaylistVideoIds(playlistId);
    return { videos: await fetchVideosInOrder(ids), feedOnly: false };
}

/* ------------------------------------------------------------------ *
 * Keyless full-channel listing from the public /videos page
 * ------------------------------------------------------------------ */

const CHANNEL_PAGE_VIDEO_LIMIT = 200;
// Each continuation page adds roughly 30 videos; the cap bounds request count.
const CONTINUATION_PAGE_LIMIT = 8;

const BROWSER_HEADERS = {
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "accept-language": "en-US,en;q=0.8",
};

/** Builds the channel's /videos URL for a pasted channel link value. */
export function channelVideosPageUrl(value: string): string | null {
    const clean = value.trim();
    const channelId = clean.match(/(?:youtube\.com\/)?channel\/(UC[\w-]{20,})/i)?.[1] ?? clean.match(/^(UC[\w-]{20,})$/)?.[1];
    if (channelId) return `https://www.youtube.com/channel/${channelId}/videos`;

    const handle = clean.match(/youtube\.com\/@([\w.-]+)/i)?.[1] ?? clean.replace(/^@/, "").match(/^[\w.-]+$/)?.[0];
    if (handle) return `https://www.youtube.com/@${handle}/videos`;

    // /c/ and /user/ names are not @handles, so keep their own path style.
    const custom = clean.match(/youtube\.com\/(c|user)\/([\w.-]+)/i);
    if (custom) return `https://www.youtube.com/${custom[1].toLowerCase()}/${custom[2]}/videos`;

    return null;
}

/**
 * Reads a JSON blob embedded in page HTML, like `var ytInitialData = {...};`.
 * Brace counting is string-aware so `}` and `;` inside values do not cut the
 * object short the way a regex would.
 */
export function extractEmbeddedJson(html: string, marker: string): unknown | null {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) return null;
    const start = html.indexOf("{", markerIndex);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < html.length; index++) {
        const char = html[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === "{") depth++;
        else if (char === "}") {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(html.slice(start, index + 1));
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

/** Pulls plain text out of YouTube's runs/simpleText/accessibility shapes. */
function ytText(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    const record = node as Record<string, unknown>;
    if (typeof record.simpleText === "string") return record.simpleText;
    if (Array.isArray(record.runs)) {
        const text = record.runs.map((run) => (run as { text?: string }).text ?? "").join("");
        return text || null;
    }
    if (typeof record.content === "string") return record.content;
    return null;
}

/** Turns a grid "12:34" or "1:02:34" length label into seconds. */
export function parseClockDuration(value: string): number | null {
    const parts = value.trim().split(":").map(Number);
    if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return seconds > 0 ? seconds : null;
}

const RELATIVE_UNIT_MS: Record<string, number> = {
    s: 1_000,
    sec: 1_000,
    second: 1_000,
    seconds: 1_000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
    w: 604_800_000,
    week: 604_800_000,
    weeks: 604_800_000,
    mo: 2_592_000_000,
    month: 2_592_000_000,
    months: 2_592_000_000,
    y: 31_536_000_000,
    yr: 31_536_000_000,
    year: 31_536_000_000,
    years: 31_536_000_000,
};

/**
 * Grid pages only say "3 weeks ago" (or the compact "7d ago"), so the stored
 * date is approximate. That is fine: publishedAt is a sort key and stored
 * metadata, never shown to the learner as an exact date.
 */
export function relativeTimeToIso(value: string): string | null {
    // Longer unit names come first so "months" does not stop at "m".
    const match = value.match(
        /(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|secs?|mins?|hrs?|yrs?|mo|s|m|h|d|w|y)\s*ago/i,
    );
    if (!match) return null;
    const amount = Number(match[1]);
    const unitMs = RELATIVE_UNIT_MS[match[2].toLowerCase()];
    if (!Number.isFinite(amount) || !unitMs) return null;
    return new Date(Date.now() - amount * unitMs).toISOString();
}

function channelPageResource(videoId: string, fields: Partial<DiscoveredResource>, out: Map<string, DiscoveredResource>): void {
    if (out.has(videoId)) return;
    out.set(videoId, {
        kind: "video",
        source: "youtube-channel-page",
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: "Untitled video",
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        ...fields,
    });
}

/** Legacy renderer: videoRenderer and gridVideoRenderer payloads. */
function addChannelPageVideo(renderer: Record<string, unknown>, out: Map<string, DiscoveredResource>): void {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : null;
    if (!videoId) return;

    const durationText = ytText(renderer.lengthText);
    const publishedText = ytText(renderer.publishedTimeText) ?? lockupPublishedText(renderer.videoInfo);
    channelPageResource(
        videoId,
        {
            title: ytText(renderer.title) ?? "Untitled video",
            creator: ytText(renderer.ownerText) ?? ytText(renderer.shortBylineText) ?? null,
            durationSeconds: durationText ? parseClockDuration(durationText) : null,
            publishedAt: publishedText ? relativeTimeToIso(publishedText) : null,
        },
        out,
    );
}

const CLOCK_TEXT = /^\d+(?::\d+)+$/;

/** Finds the duration badge ("8:54") inside a lockupViewModel's overlays. */
function lockupDurationText(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = lockupDurationText(item);
            if (found) return found;
        }
        return null;
    }
    const record = node as Record<string, unknown>;
    const badge = record.thumbnailBadgeViewModel as Record<string, unknown> | undefined;
    if (badge && typeof badge.text === "string" && CLOCK_TEXT.test(badge.text)) return badge.text;
    for (const value of Object.values(record)) {
        const found = lockupDurationText(value);
        if (found) return found;
    }
    return null;
}

/** Finds the "7 days ago" part inside a lockup's metadata rows. */
function lockupPublishedText(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = lockupPublishedText(item);
            if (found) return found;
        }
        return null;
    }
    const record = node as Record<string, unknown>;
    const textValue = record.text;
    for (const candidate of [
        record.accessibilityLabel,
        typeof textValue === "string" ? textValue : (textValue as Record<string, unknown> | undefined)?.content,
    ]) {
        if (typeof candidate === "string" && /\bago\b/i.test(candidate) && relativeTimeToIso(candidate)) return candidate;
    }
    for (const value of Object.values(record)) {
        const found = lockupPublishedText(value);
        if (found) return found;
    }
    return null;
}

const VIEW_COUNT_TEXT = /^[\d\s.,KMmb]+$/;

/**
 * Playlist lockups lead their metadata with the channel name; channel grids
 * omit it. The creator part is plain text: no leadingIcon (views) and no
 * relative date. Anything shaped like a count or a delimiter is skipped.
 */
function lockupCreatorText(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = lockupCreatorText(item);
            if (found) return found;
        }
        return null;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.metadataParts)) {
        for (const part of record.metadataParts as Array<Record<string, unknown>>) {
            const content = (part.text as Record<string, unknown> | undefined)?.content;
            if (typeof content !== "string") continue;
            if (part.leadingIcon || /\bago\b/i.test(content)) continue;
            const cleaned = content.trim();
            if (cleaned.length > 1 && !VIEW_COUNT_TEXT.test(cleaned)) return cleaned;
        }
    }
    for (const value of Object.values(record)) {
        const found = lockupCreatorText(value);
        if (found) return found;
    }
    return null;
}

/**
 * Current renderer: richItemRenderer wraps a lockupViewModel. Playlists and
 * shorts share the shape, so only LOCKUP_CONTENT_TYPE_VIDEO counts.
 */
function addChannelPageLockup(lockup: Record<string, unknown>, out: Map<string, DiscoveredResource>): void {
    if (lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;
    const videoId = typeof lockup.contentId === "string" ? lockup.contentId : null;
    if (!videoId) return;

    const metadata = (lockup.metadata as Record<string, unknown> | undefined)?.lockupMetadataViewModel as
        | Record<string, unknown>
        | undefined;
    const title = (metadata?.title as Record<string, unknown> | undefined)?.content;
    const durationText = lockupDurationText(lockup);
    const publishedText = lockupPublishedText(metadata ?? lockup);
    channelPageResource(
        videoId,
        {
            title: typeof title === "string" ? title : "Untitled video",
            creator: lockupCreatorText(metadata),
            durationSeconds: durationText ? parseClockDuration(durationText) : null,
            publishedAt: publishedText ? relativeTimeToIso(publishedText) : null,
        },
        out,
    );
}

/**
 * Walks a ytInitialData or continuation payload and collects every video
 * renderer, wherever YouTube nested it this month. Shorts render as
 * reelItemRenderer, shortsLockupViewModel or non-video lockups, which this
 * ignores on purpose.
 */
function collectChannelPageVideos(node: unknown, out: Map<string, DiscoveredResource>, limit: number): void {
    if (out.size >= limit || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
        for (const item of node) collectChannelPageVideos(item, out, limit);
        return;
    }
    const record = node as Record<string, unknown>;
    const renderer = (record.videoRenderer ?? record.gridVideoRenderer ?? record.playlistVideoRenderer) as
        | Record<string, unknown>
        | undefined;
    if (renderer && typeof renderer === "object") {
        addChannelPageVideo(renderer, out);
        return;
    }
    const lockup = record.lockupViewModel as Record<string, unknown> | undefined;
    if (lockup && typeof lockup === "object") {
        addChannelPageLockup(lockup, out);
        return;
    }
    for (const value of Object.values(record)) collectChannelPageVideos(value, out, limit);
}

/** True when a subtree holds at least one collectible video entry. */
function containsVideoItem(node: unknown): boolean {
    if (!node || typeof node !== "object") return false;
    if (Array.isArray(node)) return node.some(containsVideoItem);
    const record = node as Record<string, unknown>;
    if (record.videoRenderer || record.gridVideoRenderer || record.playlistVideoRenderer) return true;
    const lockup = record.lockupViewModel as Record<string, unknown> | undefined;
    if (lockup && lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") return true;
    return Object.values(record).some(containsVideoItem);
}

/**
 * Finds the video list's "load more" token. Pages carry several
 * continuationItemRenderers (reloads, other shelves), so tokens are taken
 * only from containers that actually list videos, in document order; flat
 * continuation responses have no container and get the plain search.
 */
export function lastContinuationToken(node: unknown): string | null {
    let found: string | null = null;
    const tokenIn = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
            value.forEach(tokenIn);
            return;
        }
        const record = value as Record<string, unknown>;
        const item = record.continuationItemRenderer as Record<string, unknown> | undefined;
        if (item && typeof item === "object") {
            const endpoint = item.continuationEndpoint as Record<string, unknown> | undefined;
            const command = endpoint?.continuationCommand as Record<string, unknown> | undefined;
            if (command && typeof command.token === "string") found = command.token;
            return;
        }
        for (const entry of Object.values(record)) tokenIn(entry);
    };

    const containers: unknown[] = [];
    const findVideoLists = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
            value.forEach(findVideoLists);
            return;
        }
        const record = value as Record<string, unknown>;
        for (const key of ["richGridRenderer", "playlistVideoListRenderer", "itemSectionRenderer"]) {
            const container = record[key];
            if (container && typeof container === "object" && containsVideoItem(container)) {
                containers.push(container);
                return;
            }
        }
        for (const entry of Object.values(record)) findVideoLists(entry);
    };
    findVideoLists(node);
    for (const container of containers) tokenIn(container);
    if (!found) tokenIn(node);
    return found;
}

interface InnerTubeClient {
    apiKey: string | null;
    clientName: string;
    clientVersion: string;
    visitorData: string | null;
    pageUrl: string;
}

/** Reads the request credentials YouTube itself embeds in the page config. */
function innerTubeClientFromHtml(html: string, pageUrl: string): InnerTubeClient {
    return {
        apiKey: html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? null,
        clientName: html.match(/"INNERTUBE_CLIENT_NAME":"([^"]+)"/)?.[1] ?? "WEB",
        clientVersion: html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? "2.20240726.00.00",
        visitorData: html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] ?? null,
        pageUrl,
    };
}

/** Fetches the next grid page through YouTube's own internal endpoint. */
async function fetchChannelContinuation(client: InnerTubeClient, token: string): Promise<unknown | null> {
    if (!client.apiKey) return null;
    try {
        const response = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${client.apiKey}&prettyPrint=false`, {
            method: "POST",
            headers: {
                ...BROWSER_HEADERS,
                "content-type": "application/json",
                origin: "https://www.youtube.com",
                referer: client.pageUrl,
                "x-youtube-client-name": "1",
                "x-youtube-client-version": client.clientVersion,
            },
            body: JSON.stringify({
                context: {
                    client: {
                        hl: "en",
                        gl: "US",
                        clientName: client.clientName,
                        clientVersion: client.clientVersion,
                        platform: "DESKTOP",
                        originalUrl: client.pageUrl,
                        ...(client.visitorData ? { visitorData: client.visitorData } : {}),
                    },
                },
                continuation: token,
            }),
            signal: AbortSignal.timeout(20_000),
        });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function fetchListingPage(pageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(pageUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20_000) });
        return response.ok ? await response.text() : null;
    } catch {
        return null;
    }
}

/** Collects videos from page HTML, then follows grid continuations for more. */
async function videosFromListingHtml(html: string, pageUrl: string): Promise<DiscoveredResource[]> {
    const videos = new Map<string, DiscoveredResource>();
    const initial = extractEmbeddedJson(html, "ytInitialData");
    let continuation: string | null = null;
    if (initial) {
        collectChannelPageVideos(initial, videos, CHANNEL_PAGE_VIDEO_LIMIT);
        continuation = lastContinuationToken(initial);
    }

    const client = innerTubeClientFromHtml(html, pageUrl);
    for (let page = 0; continuation && videos.size < CHANNEL_PAGE_VIDEO_LIMIT && page < CONTINUATION_PAGE_LIMIT; page++) {
        const before = videos.size;
        const next = await fetchChannelContinuation(client, continuation);
        if (!next) break;
        collectChannelPageVideos(next, videos, CHANNEL_PAGE_VIDEO_LIMIT);
        continuation = lastContinuationToken(next);
        if (videos.size === before) break;
    }
    return [...videos.values()];
}

/**
 * Keyless replacement for the uploads playlist: scrape the channel's public
 * /videos page, then follow its own continuation tokens for older videos.
 * Fragile by nature — YouTube can change the page shape — so every failure
 * mode returns what it has and the caller falls back to the 15-item feed.
 */
export async function listChannelVideosFromPage(
    value: string,
): Promise<{ videos: DiscoveredResource[]; channelId: string | null }> {
    const pageUrl = channelVideosPageUrl(value);
    if (!pageUrl) return { videos: [], channelId: null };

    const html = await fetchListingPage(pageUrl);
    if (!html) return { videos: [], channelId: null };
    const videos = await videosFromListingHtml(html, pageUrl);
    return { videos, channelId: channelIdFromHtml(html) };
}

/** Keyless playlist listing: same scrape on the public playlist page. */
export async function listPlaylistVideosFromPage(playlistId: string): Promise<DiscoveredResource[]> {
    const pageUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    const html = await fetchListingPage(pageUrl);
    return html ? videosFromListingHtml(html, pageUrl) : [];
}

function isWithinDurationRange(video: DiscoveredResource): boolean {
    if (!video.durationSeconds) return true;
    return video.durationSeconds >= MIN_VIDEO_SECONDS && video.durationSeconds <= MAX_VIDEO_SECONDS;
}

async function listChannelVideos(value: string): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    const hasKey = Boolean(getYouTubeApiKey());

    // Without a key, the channel's own /videos page lists the full catalogue.
    // The RSS feed (latest 15) stays the fallback when the scrape comes back
    // empty, which is what feedOnly still warns about.
    if (!hasKey) {
        const scraped = await listChannelVideosFromPage(value);
        if (scraped.videos.length > 0) {
            return { videos: scraped.videos.filter(isWithinDurationRange), feedOnly: false };
        }
        const feedChannelId = scraped.channelId ?? (await resolveChannelIdWithoutKey(value));
        if (!feedChannelId) return { videos: [], feedOnly: true };
        return { videos: await fetchChannelFeed(feedChannelId), feedOnly: true };
    }

    // For @handles and UC ids the Data API is authoritative, so it goes first;
    // /c/ and /user/ links rely on the HTML scrape for the channel id.
    const apiResolvable = value.startsWith("@") || /^UC[\w-]{20,}$/.test(value);
    let channelId: string | null = null;
    let uploadsPlaylistId: string | null = null;

    if (apiResolvable) {
        const info = await resolveChannel(value);
        if (info) {
            channelId = info.channelId;
            uploadsPlaylistId = info.uploadsPlaylistId;
        }
    }
    if (!channelId) channelId = await resolveChannelIdWithoutKey(value);
    if (!channelId) return { videos: [], feedOnly: false };

    const playlistId = uploadsPlaylistId ?? (await cachedChannel(channelId))?.uploadsPlaylistId ?? null;
    if (!playlistId) return { videos: [], feedOnly: false };

    // The uploads playlist is newest first; the cap keeps the pack current
    // while known durations outside the range (Shorts, streams) drop out.
    const ids = await listPlaylistVideoIds(playlistId);
    const videos = (await fetchVideosInOrder(ids)).filter(
        (video) => !video.durationSeconds || (video.durationSeconds >= MIN_VIDEO_SECONDS && video.durationSeconds <= MAX_VIDEO_SECONDS),
    );
    return { videos, feedOnly: false };
}

/**
 * Lists the videos behind one pasted YouTube link for the links entry point.
 * Errors throw so the caller can warn per link and continue with the rest.
 * `feedOnly` marks listings capped at the latest 15 feed entries.
 */
export async function listLinkVideos(link: SourceLink): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    if (link.kind === "video") return listVideoById(link.videoId);
    if (link.kind === "playlist") return listPlaylistVideos(link.playlistId);
    return listChannelVideos(link.value);
}
