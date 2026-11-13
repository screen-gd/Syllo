import { createHash } from "node:crypto";
import { z } from "zod";
import { getScoutDb, nowIso, type ScoutDatabase } from "./db";
import { fetchTranscript, markTranscriptFetched, type TranscriptSegment } from "./fetch/transcripts";
import { formatTimestamp } from "./format";
import { scoutGenerateObject, type ScoutLlmConfig } from "./llm";
import { SCOUT_PROMPTS } from "./prompts";
import type { VideoChapterInput, VideoCheck, VideoChecksResult } from "./types";

/**
 * Recall questions for a video, one per chapter.
 *
 * The transcript is read once and cached with its timestamps. Gemini writes
 * the question and a short model answer; the excerpt the learner checks
 * against is cut from the real transcript, so it can never be invented.
 */

export interface VideoSection {
    index: number;
    label: string;
    start: number;
    end: number;
    /** True when the section comes from the video's own chapters. */
    fromChapter: boolean;
    segments: TranscriptSegment[];
}

const MIN_SECTION_WORDS = 40;
const MAX_SECTION_CHARS = 6000;
const MAX_TOTAL_CHARS = 80_000;
const UNTIMED_SECTION_COUNT = 3;
const RETRY_UNAVAILABLE_MS = 24 * 60 * 60 * 1000;

function transcriptEnd(segments: TranscriptSegment[]) {
    const last = segments.at(-1);
    return last ? last.start + last.duration : 0;
}

function wordCount(segments: TranscriptSegment[]) {
    return segments.reduce((count, segment) => count + segment.text.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Splits a transcript into the stretches that get one question each. With two
 * or more chapters, sections follow the chapters. Without them, the video is
 * cut into three even parts that are asked about after watching, not during.
 */
export function splitIntoSections(
    segments: TranscriptSegment[],
    chapters: VideoChapterInput[],
    durationSeconds?: number | null,
): VideoSection[] {
    if (segments.length === 0) return [];
    const end = Math.max(durationSeconds ?? 0, transcriptEnd(segments));
    const ordered = [...chapters]
        .filter((chapter) => Number.isFinite(chapter.seconds) && chapter.seconds >= 0 && chapter.seconds < end)
        .sort((a, b) => a.seconds - b.seconds)
        .filter((chapter, index, list) => index === 0 || chapter.seconds > list[index - 1].seconds);

    const bounds =
        ordered.length >= 2
            ? ordered.map((chapter, index) => ({
                  label: chapter.label.trim() || formatTimestamp(chapter.seconds),
                  start: index === 0 ? 0 : chapter.seconds,
                  end: ordered[index + 1]?.seconds ?? end,
                  fromChapter: true,
              }))
            : Array.from({ length: UNTIMED_SECTION_COUNT }, (_, index) => {
                  const size = end / UNTIMED_SECTION_COUNT;
                  return {
                      label: `Part ${index + 1}`,
                      start: index * size,
                      end: index === UNTIMED_SECTION_COUNT - 1 ? end : (index + 1) * size,
                      fromChapter: false,
                  };
              });

    return bounds
        .map((bound, index) => ({
            index,
            ...bound,
            segments: segments.filter((segment) => segment.start >= bound.start && segment.start < bound.end),
        }))
        .filter((section) => wordCount(section.segments) >= MIN_SECTION_WORDS)
        .map((section, index) => ({ ...section, index }));
}

function timestamped(segments: TranscriptSegment[], limit: number) {
    let text = "";
    for (const segment of segments) {
        const line = `[${formatTimestamp(segment.start)}] ${segment.text.replace(/\s+/g, " ").trim()}\n`;
        if (text.length + line.length > limit) break;
        text += line;
    }
    return text.trim();
}

/** The transcript lines that start at `seconds`: up to four lines or 30 seconds. */
export function sourceExcerpt(segments: TranscriptSegment[], seconds: number) {
    const startIndex = Math.max(
        0,
        segments.findLastIndex((segment) => segment.start <= seconds + 0.5),
    );
    const first = segments[startIndex];
    if (!first) return { start: seconds, lines: [] };
    const lines: string[] = [];
    let chars = 0;
    for (const segment of segments.slice(startIndex)) {
        if (lines.length >= 4 || segment.start - first.start > 30) break;
        const text = segment.text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (chars + text.length > 420 && lines.length > 0) break;
        lines.push(text);
        chars += text.length;
    }
    return { start: first.start, lines };
}

export const checkDraftSchema = z.object({
    checks: z
        .array(
            z.object({
                sectionIndex: z.number().int(),
                question: z.string(),
                answer: z.string(),
                evidenceSeconds: z.number(),
            }),
        )
        .max(40),
});

export type CheckDraft = z.infer<typeof checkDraftSchema>;

/** Keeps one usable question per section and attaches the real excerpt. */
export function buildChecks(draft: CheckDraft, sections: VideoSection[], videoId: string): VideoCheck[] {
    const seen = new Set<number>();
    const checks: VideoCheck[] = [];
    for (const item of draft.checks) {
        const section = sections.find((candidate) => candidate.index === item.sectionIndex);
        if (!section || seen.has(section.index)) continue;
        const question = item.question.replace(/\s+/g, " ").trim();
        const answer = item.answer.replace(/\s+/g, " ").trim();
        if (question.length < 8 || question.length > 260 || !answer || answer.length > 500) continue;
        const inside = item.evidenceSeconds >= section.start && item.evidenceSeconds < section.end;
        const excerpt = sourceExcerpt(section.segments, inside ? item.evidenceSeconds : section.start);
        if (excerpt.lines.length === 0) continue;
        seen.add(section.index);
        checks.push({
            id: `${videoId}:${Math.floor(section.start)}`,
            label: section.label,
            sectionStart: section.start,
            sectionEnd: section.end,
            pauseAt: section.fromChapter ? section.end : null,
            question,
            answer,
            sourceStart: excerpt.start,
            sourceLines: excerpt.lines,
        });
    }
    return checks.sort((a, b) => a.sectionStart - b.sectionStart);
}

function sectionPrompt(title: string, sections: VideoSection[]) {
    const perSection = Math.min(MAX_SECTION_CHARS, Math.floor(MAX_TOTAL_CHARS / Math.max(1, sections.length)));
    return JSON.stringify({
        title,
        sections: sections.map((section) => ({
            index: section.index,
            label: section.label,
            start: Math.floor(section.start),
            end: Math.floor(section.end),
            transcript: timestamped(section.segments, perSection),
        })),
    });
}

/** Cached checks carry chapter labels, so the labels are part of the key. */
export function checksSignature(chapters: VideoChapterInput[]) {
    const layout = [...chapters]
        .map((chapter) => [Math.floor(chapter.seconds), chapter.label.trim()] as const)
        .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    const labels = createHash("sha256").update(JSON.stringify(layout.map(([, label]) => label))).digest("base64url");
    return `check.v${SCOUT_PROMPTS.check.version}:${layout.map(([seconds]) => seconds).join(",")}:${labels}`;
}

export interface VideoChecksDeps {
    db: () => ScoutDatabase;
    readTranscript: (videoId: string) => Promise<{ status: string; segments: TranscriptSegment[] }>;
    generate: (input: { title: string; sections: VideoSection[]; config: Partial<ScoutLlmConfig> | null }) => Promise<CheckDraft>;
    now: () => number;
}

const defaultDeps: VideoChecksDeps = {
    db: getScoutDb,
    async readTranscript(videoId) {
        const result = await fetchTranscript(videoId);
        markTranscriptFetched();
        return result;
    },
    async generate({ title, sections, config }) {
        const result = await scoutGenerateObject({
            schema: checkDraftSchema,
            system: SCOUT_PROMPTS.check.body,
            prompt: sectionPrompt(title, sections),
            config,
        });
        return result.object;
    },
    now: Date.now,
};

const storedSegments = z.array(z.object({ text: z.string(), start: z.number(), duration: z.number() }));
const storedChecks = z.array(
    z.object({
        id: z.string(),
        label: z.string(),
        sectionStart: z.number(),
        sectionEnd: z.number(),
        pauseAt: z.number().nullable(),
        question: z.string(),
        answer: z.string(),
        sourceStart: z.number(),
        sourceLines: z.array(z.string()),
    }),
);

async function loadTranscript(videoId: string, deps: VideoChecksDeps): Promise<TranscriptSegment[] | null> {
    const db = deps.db();
    const row = db
        .prepare(`SELECT status, segments, fetched_at FROM video_transcripts WHERE video_id = ?`)
        .get(videoId) as { status: string; segments: string; fetched_at: string } | undefined;
    if (row?.status === "ok") {
        const parsed = storedSegments.safeParse(JSON.parse(row.segments));
        if (parsed.success && parsed.data.length > 0) return parsed.data;
    }
    if (row && row.status !== "ok" && deps.now() - Date.parse(row.fetched_at) < RETRY_UNAVAILABLE_MS) return null;

    const result = await deps.readTranscript(videoId);
    const ok = result.status === "ok" && result.segments.length > 0;
    db.prepare(
        `INSERT INTO video_transcripts (video_id, status, segments, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(video_id) DO UPDATE SET status = excluded.status, segments = excluded.segments, fetched_at = excluded.fetched_at`,
    ).run(videoId, ok ? "ok" : "unavailable", ok ? JSON.stringify(result.segments) : "[]", new Date(deps.now()).toISOString());
    return ok ? result.segments : null;
}

export async function getVideoChecks(
    input: {
        videoId: string;
        title: string;
        chapters: VideoChapterInput[];
        durationSeconds?: number | null;
        config?: Partial<ScoutLlmConfig> | null;
    },
    deps: VideoChecksDeps = defaultDeps,
): Promise<VideoChecksResult> {
    const db = deps.db();
    const signature = checksSignature(input.chapters);
    const cached = db
        .prepare(`SELECT checks FROM video_checks WHERE video_id = ? AND signature = ?`)
        .get(input.videoId, signature) as { checks: string } | undefined;
    if (cached) {
        const parsed = storedChecks.safeParse(JSON.parse(cached.checks));
        if (parsed.success) return { status: "ready", checks: parsed.data };
    }

    const segments = await loadTranscript(input.videoId, deps);
    if (!segments) return { status: "no_transcript", checks: [] };

    const sections = splitIntoSections(segments, input.chapters, input.durationSeconds);
    if (sections.length === 0) return { status: "no_transcript", checks: [] };

    const draft = await deps.generate({ title: input.title, sections, config: input.config ?? null });
    const checks = buildChecks(draft, sections, input.videoId);
    db.prepare(
        `INSERT INTO video_checks (video_id, signature, checks, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(video_id, signature) DO UPDATE SET checks = excluded.checks, created_at = excluded.created_at`,
    ).run(input.videoId, signature, JSON.stringify(checks), nowIso());
    return { status: "ready", checks };
}
