import { discoverForGoal, discoverNewFromSources } from "./discovery/combine";
import { extractResource } from "./extract";
import { readArticle } from "./fetch/reader";
import { fetchTranscript, markTranscriptFetched, transcriptDelayMs } from "./fetch/transcripts";
import { JobDeferred, enqueueJob } from "./jobs";
import { recallScoutLlm, rememberScoutLlm, ScoutError, type ScoutLlmConfig } from "./llm";
import {
    approvePackPicks,
    attachResourceToPack,
    countPackResources,
    countUnprocessedPackResources,
    createPack,
    failPack,
    getPackRow,
    getResourceRow,
    latestGoal,
    packProcessingFinished,
    packResourceRows,
    saveResourceExtraction,
    setResourceError,
    toScoutResource,
    updatePack,
    upsertDiscoveredResource,
    type ResourceRow,
} from "./pack";
import { buildWorkspace } from "./plan";
import { registerJobHandler } from "./runner";
import { getScoutSettings } from "./settings";
import { listEnabledSources, touchSource } from "./sources";
import type { JobRow } from "./types";

const DISCOVERY_LIMIT = 14;

function asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function messageFor(error: unknown) {
    return error instanceof Error ? error.message : String(error ?? "Scout stopped unexpectedly");
}

/* ------------------------------------------------------------------ *
 * discover
 * ------------------------------------------------------------------ */

async function handleDiscover(_job: JobRow, payload: Record<string, unknown>) {
    const packId = asString(payload.packId);
    if (!packId) throw new Error("discover job is missing a packId");

    const pack = getPackRow(packId);
    if (!pack) throw new Error(`Pack ${packId} no longer exists`);
    if (pack.status !== "discovering") return { skipped: true };

    updatePack(packId, { progress: 6, stage: "Looking for free resources" });

    const discovered = await discoverForGoal({ goal: pack.goal, limit: DISCOVERY_LIMIT, llm: recallScoutLlm(packId) }).catch(error => { failPack(packId, error); return []; });
    if (getPackRow(packId)?.status === "failed") return { found: 0 };
    if (discovered.length === 0) {
        failPack(
            packId,
            new Error("No free resources matched that goal. Add a channel or site in Sources and try again."),
        );
        return { found: 0 };
    }

    const rows = discovered.map((item, index) => {
        const row = upsertDiscoveredResource(item);
        attachResourceToPack(packId, row.id, index);
        return row;
    });

    updatePack(packId, {
        status: "processing",
        progress: 10,
        stage: `Found ${rows.length} candidates — reading them now`,
    });

    // A small stagger avoids fifteen identical requests in the same tick; the
    // transcript throttle in the handler does the real pacing.
    rows.forEach((row, index) => {
        enqueueJob(
            "process_resource",
            { packId, resourceId: row.id },
            { maxAttempts: 4, runAfter: new Date(Date.now() + index * 1_000) },
        );
    });

    return { found: rows.length };
}

/* ------------------------------------------------------------------ *
 * process_resource
 * ------------------------------------------------------------------ */

interface TextResult {
    text: string;
    segments?: Array<{ text: string; start: number }>;
    transcript?: string | null;
    transcriptStatus: "ok" | "unavailable" | "skipped";
    transcriptChars: number;
    error?: string;
}

async function textFor(row: ResourceRow): Promise<TextResult> {
    if (row.kind === "video") {
        if (!row.external_id) {
            return {
                text: row.description ?? "",
                transcriptStatus: "skipped",
                transcriptChars: 0,
                error: "No video id for this resource",
            };
        }

        // Transcript scraping is the slow, rate-limited step. Deferring keeps
        // the queue honest instead of sleeping inside a handler.
        const delay = transcriptDelayMs();
        if (delay > 0) throw new JobDeferred(delay, "Waiting for the next transcript slot");

        const transcript = await fetchTranscript(row.external_id);
        markTranscriptFetched();

        if (transcript.status === "ok") {
            return {
                text: transcript.text,
                segments: transcript.segments.map((segment) => ({ text: segment.text, start: segment.start })),
                transcript: transcript.text,
                transcriptStatus: "ok",
                transcriptChars: transcript.text.length,
            };
        }

        return {
            text: row.description ?? "",
            transcriptStatus: transcript.status,
            transcriptChars: 0,
            error: transcript.error,
        };
    }

    const article = await readArticle(row.url);
    if (article.status === "ok") {
        return { text: article.text, transcriptStatus: "ok", transcriptChars: article.text.length };
    }

    return {
        text: row.description ?? "",
        transcriptStatus: "skipped",
        transcriptChars: 0,
        error: article.error ?? "Could not read this page",
    };
}

async function handleProcessResource(job: JobRow, payload: Record<string, unknown>) {
    const packId = asString(payload.packId);
    const resourceId = asString(payload.resourceId);
    if (!packId || !resourceId) throw new Error("process_resource job is missing ids");

    const row = getResourceRow(resourceId);
    if (!row) return { skipped: true };
    if (getPackRow(packId)?.status === "failed") return { skipped: true };
    if (row.summary && row.transcript_status !== "pending") {
        settlePackIfProcessed(packId);
        return { cached: true };
    }

    try {
        const source = await textFor(row);
        if (source.transcriptStatus !== "ok" || source.text.trim().length < 80) {
            saveResourceExtraction(row.id, { summary: "Scout could not read this source. It remains available as a manual link.", keyPoints: [], skillTags: [], chapters: [], transcript: null, transcriptStatus: "skipped", transcriptChars: 0, error: source.error || "Source text is unavailable" });
            settlePackIfProcessed(packId);
            return { resourceId, unread: true };
        }

        const extraction = await extractResource({
            packId,
            resource: {
                id: row.id,
                kind: row.kind,
                title: row.title,
                creator: row.creator,
                description: row.description,
                durationSeconds: row.duration_seconds,
                externalId: row.external_id,
                transcriptStatus: source.transcriptStatus,
            },
            text: source.text,
            segments: source.segments,
            config: recallScoutLlm(packId),
        });

        const existingChapters = JSON.parse(row.chapters || "[]") as typeof extraction.chapters;
        const chapters = extraction.chapters.length > 0 ? extraction.chapters : existingChapters;
        const lastEnd = chapters.reduce((max, chapter) => Math.max(max, chapter.endSeconds ?? 0), 0);

        saveResourceExtraction(row.id, {
            summary: extraction.summary || "No summary could be produced for this resource yet.",
            keyPoints: extraction.keyPoints,
            skillTags: extraction.skills,
            chapters,
            transcript: source.transcript ?? null,
            transcriptStatus: source.transcriptStatus,
            transcriptChars: source.transcriptChars,
            durationSeconds: row.duration_seconds ?? (lastEnd > 0 ? lastEnd : null),
            error: source.error ?? extraction.error ?? null,
        });
    } catch (error) {
        // A deferral is not a failure: the runner will requeue it untouched.
        if (error instanceof JobDeferred) throw error;
        if (error instanceof ScoutError && (error.code === "quota" || error.code === "config" || error.code === "budget")) {
            failPack(packId, error);
            return { paused: true, reason: error.code };
        }

        if (job.attempts >= job.max_attempts) {
            setResourceError(resourceId, messageFor(error).slice(0, 500));
        }
        settlePackIfProcessed(packId);
        throw error;
    }

    settlePackIfProcessed(packId);
    return { resourceId };
}

/**
 * Moves a pack from "processing" to "review" once every resource has either
 * been extracted or finally failed. Picks default to everything, so the
 * approval screen opens with all cards selected.
 */
function settlePackIfProcessed(packId: string) {
    const pack = getPackRow(packId);
    if (!pack || pack.status !== "processing") return;

    const total = countPackResources(packId);
    if (total === 0) return;

    if (!packProcessingFinished(packId)) {
        const pending = countUnprocessedPackResources(packId);
        const done = Math.max(0, total - pending);
        updatePack(packId, {
            progress: Math.min(42, 10 + Math.round((done / total) * 30)),
            stage: `Reading resources (${done} of ${total})`,
        });
        return;
    }

    approvePackPicks(
        packId,
        packResourceRows(packId).filter(row => row.transcript_status === "ok").map((row) => row.id),
    );
    updatePack(packId, {
        status: "review",
        progress: 45,
        stage: "Ready for your review",
    });
}

/* ------------------------------------------------------------------ *
 * build_workspace
 * ------------------------------------------------------------------ */

async function handleBuildWorkspace(_job: JobRow, payload: Record<string, unknown>) {
    const packId = asString(payload.packId);
    if (!packId) throw new Error("build_workspace job is missing a packId");

    const pack = getPackRow(packId);
    if (!pack) throw new Error(`Pack ${packId} no longer exists`);
    if (pack.status === "ready") return { roadmapId: pack.roadmap_id };

    const picks = new Set(JSON.parse(pack.picks || "[]") as string[]);
    const resources = packResourceRows(packId)
        .filter((row) => picks.has(row.id))
        .map((row) => toScoutResource(row, true));

    if (resources.length === 0) {
        failPack(packId, new Error("Approve at least one resource before building the roadmap."));
        return { built: false };
    }

    if (resources.some(resource => resource.transcriptStatus !== "ok")) {
        failPack(packId, new Error("Scout could not read some selected sources. Uncheck those picks to build from verified material; their links remain in your resource library."));
        return { built: false };
    }
    updatePack(packId, { status: "building", progress: 55, stage: "Writing your roadmap" });

    const workspace = await buildWorkspace({
        packId,
        goal: pack.goal,
        resources,
        config: recallScoutLlm(packId),
    }).catch(error => { failPack(packId, error); return null; });
    if (!workspace) return { built: false };

    updatePack(packId, {
        status: "ready",
        progress: 100,
        stage: "Your workspace is ready",
        roadmapId: workspace.roadmap.id,
        roadmap: workspace.roadmap,
        quizzes: workspace.quizzes,
        error: null,
    });

    return { roadmapId: workspace.roadmap.id, quizzes: workspace.quizzes.length, degraded: workspace.degraded };
}

/* ------------------------------------------------------------------ *
 * auto_check
 * ------------------------------------------------------------------ */

/**
 * Nightly check. Discovery only: it has no per-pack key, so it never calls the
 * model and never touches an approved pack.
 */
async function handleAutoCheck() {
    if (getScoutSettings().paused) return { paused: true };

    const sources = listEnabledSources();
    if (sources.length === 0) return { found: 0 };

    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    const goal = latestGoal() ?? "new free tutorials";
    const discovered = await discoverNewFromSources({ goal, since, limit: 12 });

    let added = 0;
    for (const item of discovered) {
        const row = upsertDiscoveredResource(item);
        if (!row.summary) added += 1;
    }

    for (const source of sources) touchSource(source.id);

    return {
        found: discovered.length,
        added,
        highlights: discovered.slice(0, 4).map((item) => ({ title: item.title, url: item.url })),
    };
}

/* ------------------------------------------------------------------ */

export function registerPipelineHandlers() {
    registerJobHandler("discover", handleDiscover);
    registerJobHandler("process_resource", handleProcessResource);
    registerJobHandler("build_workspace", handleBuildWorkspace);
    registerJobHandler("auto_check", handleAutoCheck);
}

/** Creates a pack and queues discovery without waiting for the next tick. */
export function startPack(goal: string, llm?: ScoutLlmConfig | null) {
    const created = createPack(goal);
    if (llm) rememberScoutLlm(created.id, llm);
    enqueueJob("discover", { packId: created.id });
    return created;
}

/** Queues roadmap generation for an approved pack. */
export function queueWorkspaceBuild(packId: string) {
    updatePack(packId, { status: "building", progress: 50, stage: "Preparing your roadmap" });
    return enqueueJob("build_workspace", { packId });
}
