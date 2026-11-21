import { getScoutDb, nowIso } from "../db";
import { parseIsoDuration } from "../format";
import { dedupeResources, goalScore, type DiscoveredResource } from "./index";
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
        const channelId =
            html.match(/"channelId":"(UC[\w-]{20,})"/)?.[1] ??
            html.match(/channel\/(UC[\w-]{20,})/)?.[1] ??
            null;

        handleCache.set(handle, channelId);
        return channelId;
    } catch {
        handleCache.set(handle, null);
        return null;
    }
}

/** RSS-based goal discovery. No API key, no quota, no search.list. */
export async function discoverYouTubeFromFeeds(input: {
    goal: string;
    channels: string[];
    limit: number;
}): Promise<DiscoveredResource[]> {
    const candidates: DiscoveredResource[] = [];

    for (const channel of input.channels.slice(0, 6)) {
        try {
            const channelId = await resolveChannelIdWithoutKey(channel);
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
        const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`, {
            signal: AbortSignal.timeout(15_000),
        });
        return { videos: response.ok ? parseYouTubeFeed(await response.text()) : [], feedOnly: true };
    }

    const ids = await listPlaylistVideoIds(playlistId);
    return { videos: await fetchVideosInOrder(ids), feedOnly: false };
}

async function listChannelVideos(value: string): Promise<{ videos: DiscoveredResource[]; feedOnly: boolean }> {
    const hasKey = Boolean(getYouTubeApiKey());
    let channelId = await resolveChannelIdWithoutKey(value);
    if (!channelId && hasKey) channelId = (await resolveChannel(value))?.channelId ?? null;
    if (!channelId) return { videos: [], feedOnly: !hasKey };

    if (!hasKey) {
        return { videos: await fetchChannelFeed(channelId), feedOnly: true };
    }

    const info = await cachedChannel(channelId);
    if (!info) return { videos: [], feedOnly: false };

    // The uploads playlist is newest first; the cap keeps the pack current
    // while known durations outside the range (Shorts, streams) drop out.
    const ids = await listPlaylistVideoIds(info.uploadsPlaylistId);
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
