import { z } from "zod";
import { clip, deepLink, parseDescriptionChapters, quoteAppearsIn, normalizeForMatch, chunkText } from "./format";
import { scoutGenerateObject, ScoutError, type ScoutLlmConfig } from "./llm";
import { SCOUT_PROMPTS } from "./prompts";
import type { Chapter, KeyPoint, ResourceKind, TranscriptStatus } from "./types";

/** The LLM contract. Kept small so a flash model can hold it. */
export const extractionSchema = z.object({
    summary: z.string(),
    keyPoints: z
        .array(
            z.object({
                text: z.string(),
                atSeconds: z.number().nullable().optional(),
                quote: z.string().nullable().optional(),
            }),
        )
        .default([]),
    skills: z.array(z.string()).default([]),
    chapters: z
        .array(
            z.object({
                startSeconds: z.number(),
                title: z.string(),
            }),
        )
        .default([]),
});

export type ExtractionOutput = z.infer<typeof extractionSchema>;

export const bookOutlineSchema = z.object({
    chapters: z.array(z.string()).default([]),
    confident: z.boolean().default(false),
});

export interface ExtractionInput {
    packId?: string | null;
    resource: {
        id: string;
        kind: ResourceKind;
        title: string;
        creator?: string | null;
        description?: string | null;
        durationSeconds?: number | null;
        externalId?: string | null;
        transcriptStatus?: TranscriptStatus;
    };
    /** Plain text. For videos this is the transcript without markers. */
    text: string;
    /** Transcript segments, when the resource is a video. */
    segments?: Array<{ text: string; start: number }>;
    config?: Partial<ScoutLlmConfig> | null;
}

export interface ExtractionResult {
    summary: string;
    keyPoints: KeyPoint[];
    skills: string[];
    chapters: Chapter[];
    degraded: boolean;
    error?: string;
}

const SKILL_STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "the",
    "for",
    "with",
    "from",
    "into",
    "your",
    "you",
    "how",
    "to",
    "of",
    "in",
    "on",
    "video",
    "tutorial",
    "guide",
    "course",
    "part",
]);

/** "React Hooks!" and "react hooks" collapse to one module name. */
export function normalizeSkill(value: string): string | null {
    const skill = value
        .toLowerCase()
        .replace(/^#+/, "")
        .replace(/[^a-z0-9+#.\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (skill.length < 2 || skill.length > 42) return null;
    if (!skill.split(" ").some((word) => word && !SKILL_STOPWORDS.has(word))) return null;
    return skill;
}

function uniqueSkills(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const skill = normalizeSkill(value);
        if (!skill || seen.has(skill)) continue;
        seen.add(skill);
        result.push(skill);
    }
    return result.slice(0, 6);
}

function sentenceFallback(input: ExtractionInput): string {
    const description = clip(input.resource.description ?? "", 320);
    if (description.length > 40) return description;
    return `${input.resource.title}${input.resource.creator ? ` by ${input.resource.creator}` : ""}.`;
}

function stripMarkers(value: string) {
    return value.replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, " ");
}

function pickChunks(text: string, limit = 3) {
    const chunks = chunkText(text, 24_000, 600);
    if (chunks.length <= limit) return chunks;
    const middle = Math.floor(chunks.length / 2);
    return chunks.length >= 3 ? [chunks[0], chunks[middle], chunks[chunks.length - 1]] : chunks.slice(0, limit);
}

/**
 * The model is told to copy quotes verbatim. When it does not, the claim is
 * dropped rather than shown with an invented timestamp.
 */
function resolveTimestamp(
    value: number | null | undefined,
    quote: string | null | undefined,
    segments: ExtractionInput["segments"],
    durationSeconds: number | null | undefined,
): number | null {
    const max = durationSeconds && durationSeconds > 0 ? durationSeconds + 30 : Number.POSITIVE_INFINITY;

    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max) {
        return Math.floor(value);
    }

    if (!quote || !segments?.length) return null;
    const needle = normalizeForMatch(stripMarkers(quote));
    if (needle.length < 12) return null;

    for (let index = 0; index < segments.length; index += 1) {
        const window = segments
            .slice(index, index + 3)
            .map((segment) => segment.text)
            .join(" ");
        if (normalizeForMatch(window).includes(needle)) return Math.floor(segments[index].start);
    }

    return null;
}

function buildChapters(
    input: ExtractionInput,
    proposed: Array<{ startSeconds: number; title: string }>,
): Chapter[] {
    const isVideo = input.resource.kind === "video";
    if (!isVideo) return [];

    const descriptionChapters = parseDescriptionChapters(input.resource.description);
    const duration = input.resource.durationSeconds && input.resource.durationSeconds > 0 ? input.resource.durationSeconds : null;
    const externalId = input.resource.externalId ?? "";

    const fromDescription: Chapter[] = descriptionChapters
        .filter((chapter) => !duration || chapter.startSeconds <= duration)
        .map((chapter) => ({
            startSeconds: chapter.startSeconds,
            title: clip(chapter.title, 120),
            url: externalId ? deepLink(externalId, chapter.startSeconds) : `${input.resource.id}#t=${chapter.startSeconds}`,
        }));

    const source =
        fromDescription.length >= 2
            ? fromDescription
            : proposed
                  .filter((chapter) => Number.isFinite(chapter.startSeconds) && chapter.startSeconds >= 0)
                  .filter((chapter) => !duration || chapter.startSeconds <= duration + 30)
                  .map((chapter) => ({
                      startSeconds: Math.floor(chapter.startSeconds),
                      title: clip(chapter.title, 120),
                      url: externalId ? deepLink(externalId, chapter.startSeconds) : `${input.resource.id}#t=${chapter.startSeconds}`,
                  }));

    const sorted = source
        .filter((chapter, index, all) => all.findIndex((other) => other.startSeconds === chapter.startSeconds) === index)
        .sort((left, right) => left.startSeconds - right.startSeconds)
        .slice(0, 20);

    return sorted.map((chapter, index) => ({
        ...chapter,
        endSeconds:
            sorted[index + 1]?.startSeconds ??
            (duration ? Math.max(chapter.startSeconds + 30, duration) : null),
    }));
}

function mergeKeyPoints(
    outputs: ExtractionOutput[],
    input: ExtractionInput,
): KeyPoint[] {
    const source = input.text;
    const isVideo = input.resource.kind === "video";
    const seen = new Set<string>();
    const points: KeyPoint[] = [];

    for (const output of outputs) {
        for (const point of output.keyPoints) {
            const text = clip(point.text, 320);
            if (text.length < 12) continue;

            const key = normalizeForMatch(text);
            if (seen.has(key)) continue;

            const quote = point.quote ? clip(point.quote, 400) : null;
            if (quote && source && !quoteAppearsIn(stripMarkers(quote), source)) continue;
            if (!quote && isVideo) continue;

            const atSeconds = isVideo ? resolveTimestamp(point.atSeconds, quote, input.segments, input.resource.durationSeconds) : null;
            seen.add(key);
            points.push({ text, quote, atSeconds });
        }
    }

    return points.slice(0, 10);
}

function mergeSummary(outputs: ExtractionOutput[], fallback: string): string {
    const seen = new Set<string>();
    const sentences: string[] = [];

    for (const output of outputs) {
        for (const sentence of output.summary.split(/(?<=[.!?])\s+/)) {
            const clean = sentence.replace(/\s+/g, " ").trim();
            if (clean.length < 20) continue;
            const key = clean.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            sentences.push(clean);
        }
    }

    return clip(sentences.slice(0, 4).join(" ") || fallback, 900);
}

function chunkPrompt(input: ExtractionInput, chunk: string, index: number, total: number) {
    const lines = [
        `Resource: ${input.resource.title}`,
        `Creator: ${input.resource.creator ?? "unknown"}`,
        `Kind: ${input.resource.kind}`,
        `Duration: ${input.resource.durationSeconds ? `${Math.round(input.resource.durationSeconds / 60)} minutes` : "unknown"}`,
        `Description: ${clip(input.resource.description ?? "", 1200) || "(none)"}`,
    ];

    if (total > 1) lines.push(`Text part: ${index + 1} of ${total}`);
    lines.push("", "Text:", chunk);
    return lines.join("\n");
}

/**
 * Runs extraction over one resource. A provider or budget failure degrades to
 * a deterministic summary instead of failing the whole pack.
 */
export async function extractResource(input: ExtractionInput): Promise<ExtractionResult> {
    const fallbackSummary = sentenceFallback(input);

    if (!input.text.trim()) {
        return {
            summary: fallbackSummary,
            keyPoints: [],
            skills: uniqueSkills([input.resource.title.split(/[^a-zA-Z0-9+#]+/).slice(0, 3).join(" ")]),
            chapters: buildChapters(input, []),
            degraded: true,
            error: "No text available for extraction",
        };
    }

    const chunks = pickChunks(input.text);
    const outputs: ExtractionOutput[] = [];

    try {
        for (let index = 0; index < chunks.length; index += 1) {
            const result = await scoutGenerateObject({
                packId: input.packId,
                schema: extractionSchema,
                system: SCOUT_PROMPTS.extract.body,
                prompt: chunkPrompt(input, chunks[index], index, chunks.length),
                config: input.config,
            });
            outputs.push(result.object);
        }
    } catch (error) {
        const message = error instanceof ScoutError ? error.message : error instanceof Error ? error.message : "Extraction failed";
        return {
            summary: fallbackSummary,
            keyPoints: [],
            skills: uniqueSkills([input.resource.title]),
            chapters: buildChapters(input, []),
            degraded: true,
            error: message,
        };
    }

    const skills = uniqueSkills(outputs.flatMap((output) => output.skills));
    const chapters = buildChapters(input, outputs.flatMap((output) => output.chapters));

    return {
        summary: mergeSummary(outputs, fallbackSummary),
        keyPoints: mergeKeyPoints(outputs, input),
        skills: skills.length > 0 ? skills : uniqueSkills([input.resource.title]),
        chapters,
        degraded: false,
    };
}

/**
 * Books are never fetched. The outline is a suggestion the UI labels as such;
 * a single "Read the book" task is the honest fallback.
 */
export async function suggestBookOutline(input: {
    packId?: string | null;
    title: string;
    creator?: string | null;
    config?: Partial<ScoutLlmConfig> | null;
}): Promise<{ chapters: string[]; confident: boolean }> {
    try {
        const result = await scoutGenerateObject({
            packId: input.packId,
            schema: bookOutlineSchema,
            system: SCOUT_PROMPTS.book.body,
            prompt: `Title: ${input.title}\nAuthor: ${input.creator ?? "unknown"}`,
            config: input.config,
        });

        const chapters = result.object.chapters.map((chapter) => clip(chapter, 120)).filter(Boolean).slice(0, 12);
        if (chapters.length === 0) return { chapters: ["Read the book"], confident: false };
        return { chapters, confident: result.object.confident };
    } catch {
        return { chapters: ["Read the book"], confident: false };
    }
}
