import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getScoutDb } from "../db";

const run = promisify(execFile);

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface TranscriptResult {
    status: "ok" | "unavailable" | "skipped";
    segments: TranscriptSegment[];
    /** Plain text with segments joined by newlines. Used for quote validation. */
    text: string;
    /** Text prefixed with [mm:ss] markers. Used for LLM prompts. */
    timestampedText: string;
    source: "python" | "supadata" | "none";
    error?: string;
}

const EMPTY: TranscriptResult = {
    status: "unavailable",
    segments: [],
    text: "",
    timestampedText: "",
    source: "none",
};

/**
 * Supports both youtube-transcript-api 0.6.x (static get_transcript) and
 * 1.x (instance .fetch returning segment objects). The video id travels as
 * argv, never through a shell, so nothing is interpolated.
 */
const PYTHON_SCRIPT = `
import sys, json

video_id = sys.argv[1]

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception as exc:
    print(json.dumps({"ok": False, "reason": "missing_module", "error": str(exc)[:200]}))
    raise SystemExit(0)

try:
    segments = None
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
        segments = [
            {"text": seg.text, "start": seg.start, "duration": seg.duration}
            for seg in fetched
        ]
    except AttributeError:
        segments = None

    if segments is None:
        raw = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
        segments = [
            {"text": item.get("text", ""), "start": item.get("start", 0), "duration": item.get("duration", 0)}
            for item in raw
        ]

    print(json.dumps({"ok": True, "segments": segments}))
except Exception as exc:
    print(json.dumps({"ok": False, "reason": "error", "error": str(exc)[:300]}))
`;

interface PythonCandidate {
    command: string;
    available: boolean;
    checkedAt: number;
}

const globalKey = Symbol.for("syllo.scout.pythonTranscript");

type GlobalWithPython = typeof globalThis & { [globalKey]?: PythonCandidate[] };

function candidates(): PythonCandidate[] {
    const store = globalThis as GlobalWithPython;
    store[globalKey] ??= process.platform === "win32"
        ? [
              { command: "python", available: true, checkedAt: 0 },
              { command: "py", available: true, checkedAt: 0 },
              { command: "python3", available: true, checkedAt: 0 },
          ]
        : [
              { command: "python3", available: true, checkedAt: 0 },
              { command: "python", available: true, checkedAt: 0 },
          ];
    return store[globalKey];
}

function buildText(segments: TranscriptSegment[]) {
    return segments.map((segment) => segment.text.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

function buildTimestamped(segments: TranscriptSegment[]) {
    return segments
        .map((segment) => {
            const total = Math.max(0, Math.floor(segment.start));
            const minutes = Math.floor(total / 60);
            const seconds = total % 60;
            return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}] ${segment.text.replace(/\s+/g, " ").trim()}`;
        })
        .filter((line) => line.length > 9)
        .join("\n");
}

function normaliseSegments(raw: unknown): TranscriptSegment[] {
    if (!Array.isArray(raw)) return [];
    const segments: TranscriptSegment[] = [];

    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const text = typeof record.text === "string" ? record.text : "";
        if (!text.trim()) continue;

        const start = Number(record.start ?? 0);
        const duration = Number(record.duration ?? 0);
        segments.push({
            text,
            start: Number.isFinite(start) ? Math.max(0, start) : 0,
            duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
        });
    }

    return segments;
}

async function fromPython(videoId: string): Promise<TranscriptResult | null> {
    for (const candidate of candidates()) {
        if (!candidate.available) continue;

        try {
            const { stdout } = await run(candidate.command, ["-c", PYTHON_SCRIPT, videoId], {
                timeout: 60_000,
                windowsHide: true,
                maxBuffer: 32 * 1024 * 1024,
                env: { ...process.env, PYTHONIOENCODING: "utf-8" },
            });

            const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
            if (!line) continue;

            const payload = JSON.parse(line) as { ok?: boolean; reason?: string; error?: string; segments?: unknown };
            if (payload.ok) {
                const segments = normaliseSegments(payload.segments);
                if (segments.length === 0) return { ...EMPTY, error: "Transcript was empty" };
                return {
                    status: "ok",
                    segments,
                    text: buildText(segments),
                    timestampedText: buildTimestamped(segments),
                    source: "python",
                };
            }

            if (payload.reason === "missing_module") {
                candidate.available = false;
                continue;
            }

            // The module works but this video has no captions. No point trying
            // another interpreter.
            return { ...EMPTY, error: payload.error ?? "No transcript available" };
        } catch {
            candidate.available = false;
        }
    }

    return null;
}

interface SupadataResponse {
    content?: unknown;
    error?: string;
    message?: string;
}

async function _fromSupadata(videoId: string): Promise<TranscriptResult | null> {
    const key = process.env.SUPADATA_API_KEY?.trim();
    if (!key) return null;

    try {
        const url = new URL("https://api.supadata.ai/v1/youtube/transcript");
        url.searchParams.set("videoId", videoId);
        url.searchParams.set("lang", "en");

        const response = await fetch(url, {
            headers: { "x-api-key": key },
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) return null;

        const payload = (await response.json()) as SupadataResponse;
        if (!payload.content) return null;

        if (typeof payload.content === "string") {
            const segments = payload.content
                .split(/\r?\n/)
                .map((text, index) => ({ text, start: index * 5, duration: 5 }))
                .filter((segment) => segment.text.trim());
            return {
                status: "ok",
                segments,
                text: buildText(segments),
                timestampedText: buildTimestamped(segments),
                source: "supadata",
            };
        }

        if (Array.isArray(payload.content)) {
            const segments = normaliseSegments(
                payload.content.map((item) => {
                    const record = (item ?? {}) as Record<string, unknown>;
                    const offset = Number(record.offset ?? record.start ?? 0);
                    return {
                        text: record.text,
                        // Supadata offsets are milliseconds; anything already
                        // in seconds stays untouched.
                        start: offset > 10_000 ? offset / 1000 : offset,
                        duration: Number(record.duration ?? 0) > 10_000 ? Number(record.duration) / 1000 : Number(record.duration ?? 0),
                    };
                }),
            );

            if (segments.length === 0) return null;
            return {
                status: "ok",
                segments,
                text: buildText(segments),
                timestampedText: buildTimestamped(segments),
                source: "supadata",
            };
        }
    } catch {
        return null;
    }

    return null;
}

/** Free local captions only. Unread videos remain manual links. */
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
    if (!videoId.trim()) return { ...EMPTY, error: "Missing video id" };

    const local = await fromPython(videoId);
    if (local?.status === "ok") return local;

    return {
        ...EMPTY,
        status: "skipped",
        error: local?.error ?? "No transcript available",
    };
}

const KV_LAST_TRANSCRIPT = "last_transcript_at";

export function getLastTranscriptAt(): number | null {
    const row = getScoutDb().prepare(`SELECT value FROM scout_kv WHERE key = ?`).get(KV_LAST_TRANSCRIPT) as
        | { value: string }
        | undefined;
    if (!row) return null;
    const value = Number(row.value);
    return Number.isFinite(value) ? value : null;
}

export function markTranscriptFetched() {
    getScoutDb()
        .prepare(
            `INSERT INTO scout_kv (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(KV_LAST_TRANSCRIPT, String(Date.now()));
}

/**
 * YouTube throttles transcript scraping. One request every 2-3 minutes with
 * backoff is slow but survives a whole pack without a block.
 */
export function transcriptDelayMs(intervalMs = Number(process.env.SCOUT_TRANSCRIPT_INTERVAL_MS ?? 150_000)) {
    const last = getLastTranscriptAt();
    if (!last) return 0;
    return Math.max(0, last + Math.max(30_000, intervalMs) - Date.now());
}
