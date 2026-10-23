import { claimNextJob, completeJob, countJobs, deferJob, failJob, recoverStaleJobs, enqueueJob, hasQueuedJob, JobDeferred } from "./jobs";
import { getScoutSettings, markAutoCheckScheduled } from "./settings";
import type { JobKind, JobRow } from "./types";

export type JobHandler = (job: JobRow, payload: Record<string, unknown>) => Promise<unknown>;

const handlers: Partial<Record<JobKind, JobHandler>> = {};

export function registerJobHandler(kind: JobKind, handler: JobHandler) {
    handlers[kind] = handler;
}

const globalKey = Symbol.for("syllo.scout.runner");

type GlobalWithRunner = typeof globalThis & {
    [globalKey]?: { started: boolean; timer?: ReturnType<typeof setTimeout>; scheduler?: ReturnType<typeof setInterval> };
};

function runnerState() {
    const store = globalThis as GlobalWithRunner;
    if (!store[globalKey]) store[globalKey] = { started: false };
    return store[globalKey];
}

const POLL_MS = 1500;
const SCHEDULER_MS = 60_000;

/**
 * Start the in-process queue loop once per process.
 *
 * The loop is deliberately not awaited anywhere: server functions return
 * immediately and the UI polls the pack.
 */
export function ensureScoutRunner() {
    const state = runnerState();
    if (state.started) return;
    state.started = true;

    recoverStaleJobs();
    void tick();

    state.scheduler = setInterval(() => {
        void scheduleNightlyCheck();
    }, SCHEDULER_MS);
    state.scheduler.unref?.();

    void scheduleNightlyCheck();
}

async function tick() {
    const state = runnerState();
    if (!state.started) return;

    try {
        await runDueJobsOnce();
    } catch (error) {
        console.error("[scout] queue tick failed:", error);
    }

    state.timer = setTimeout(() => {
        void tick();
    }, POLL_MS);
    state.timer.unref?.();
}

/** Runs every due job once. Exported so tests can drive the queue deterministically. */
export async function runDueJobsOnce(limit = 5) {
    for (let index = 0; index < limit; index += 1) {
        const job = claimNextJob();
        if (!job) return;

        if (job.kind === "auto_check" && getScoutSettings().paused) {
            deferJob(job.id, 60 * 60_000, "Scout is paused");
            continue;
        }

        const handler = handlers[job.kind];
        if (!handler) {
            failJob(job.id, new Error(`No handler registered for job kind "${job.kind}"`));
            continue;
        }

        try {
            const payload = JSON.parse(job.payload || "{}") as Record<string, unknown>;
            const result = await handler(job, payload);
            completeJob(job.id, result ?? null);
        } catch (error) {
            if (error instanceof JobDeferred) {
                deferJob(job.id, error.delayMs, error.message);
                continue;
            }
            console.error(`[scout] job ${job.kind} (${job.id}) failed:`, error);
            failJob(job.id, error);
        }
    }
}

/** Dubai has no daylight saving, so a fixed zone lookup is enough. */
export function dubaiClock(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(now);

    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return { date: `${pick("year")}-${pick("month")}-${pick("day")}`, hour: Number(pick("hour")) };
}

/**
 * The nightly check runs at 03:00 Asia/Dubai. The scheduler polls every
 * minute, so anything in the 03:00 hour counts, and the stored date keeps it
 * to one run per night.
 */
export async function scheduleNightlyCheck(now = new Date()) {
    const settings = getScoutSettings();
    if (!settings.autoCheck || settings.paused) return false;

    const clock = dubaiClock(now);
    if (clock.hour !== 3) return false;
    if (settings.lastAutoCheckOn === clock.date) return false;
    if (hasQueuedJob("auto_check")) return false;

    enqueueJob("auto_check", { scheduledFor: clock.date });
    markAutoCheckScheduled(clock.date);
    return true;
}

export function runnerHealth() {
    return { queued: countJobs("queued"), running: countJobs("running"), failed: countJobs("failed") };
}
