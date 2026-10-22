import { getScoutDb, newId, nowIso } from "./db";
import type { JobKind, JobRow } from "./types";

export interface EnqueueOptions {
    runAfter?: Date | string;
    maxAttempts?: number;
}

/**
 * Thrown by a handler that cannot run yet (for example, the transcript
 * throttle). The runner requeues the job without spending an attempt.
 */
export class JobDeferred extends Error {
    delayMs: number;

    constructor(delayMs: number, message = "Deferred until the next slot") {
        super(message);
        this.name = "JobDeferred";
        this.delayMs = Math.max(0, delayMs);
    }
}

function asIso(value: Date | string | undefined) {
    if (!value) return nowIso();
    return typeof value === "string" ? value : value.toISOString();
}

export function enqueueJob(kind: JobKind, payload: Record<string, unknown> = {}, options: EnqueueOptions = {}): string {
    const db = getScoutDb();
    const id = newId("job");
    const now = nowIso();
    db.prepare(
        `INSERT INTO jobs (id, kind, status, payload, attempts, max_attempts, run_after, created_at, updated_at)
         VALUES (?, ?, 'queued', ?, 0, ?, ?, ?, ?)`,
    ).run(id, kind, JSON.stringify(payload), options.maxAttempts ?? 3, asIso(options.runAfter), now, now);
    return id;
}

export function getJob(id: string): JobRow | null {
    return (getScoutDb().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRow | undefined) ?? null;
}

/**
 * Atomically take the oldest due job. The read and the claim happen in one
 * transaction so two runners (or two dev restarts) cannot run the same job.
 */
export function claimNextJob(now = new Date()): JobRow | null {
    const db = getScoutDb();
    const claim = db.transaction(() => {
        const iso = now.toISOString();
        const row = db
            .prepare(`SELECT * FROM jobs WHERE status = 'queued' AND run_after <= ? ORDER BY run_after, created_at LIMIT 1`)
            .get(iso) as JobRow | undefined;

        if (!row) return null;

        db.prepare(`UPDATE jobs SET status = 'running', locked_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?`).run(
            iso,
            iso,
            row.id,
        );

        return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(row.id) as JobRow;
    });

    return claim();
}

export function completeJob(id: string, result: unknown) {
    const now = nowIso();
    getScoutDb()
        .prepare(`UPDATE jobs SET status = 'done', result = ?, error = NULL, locked_at = NULL, updated_at = ? WHERE id = ?`)
        .run(JSON.stringify(result ?? null), now, id);
}

export function failJob(id: string, error: unknown) {
    const db = getScoutDb();
    const row = getJob(id);
    if (!row) return;

    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    const now = nowIso();

    if (row.attempts >= row.max_attempts) {
        db.prepare(`UPDATE jobs SET status = 'failed', error = ?, locked_at = NULL, updated_at = ? WHERE id = ?`).run(
            message.slice(0, 2000),
            now,
            id,
        );
        return;
    }

    const backoffMs = Math.min(10 * 60_000, 30_000 * 4 ** Math.max(0, row.attempts - 1));
    db.prepare(
        `UPDATE jobs SET status = 'queued', error = ?, locked_at = NULL, run_after = ?, updated_at = ? WHERE id = ?`,
    ).run(message.slice(0, 2000), new Date(Date.now() + backoffMs).toISOString(), now, id);
}

/** Put a job back on the queue without counting it as a failed attempt. */
export function deferJob(id: string, delayMs: number, reason?: string) {
    const now = nowIso();
    getScoutDb()
        .prepare(
            `UPDATE jobs SET status = 'queued', attempts = MAX(0, attempts - 1), locked_at = NULL,
             run_after = ?, error = ?, updated_at = ? WHERE id = ?`,
        )
        .run(new Date(Date.now() + Math.max(0, delayMs)).toISOString(), reason ?? null, now, id);
}

/** Move jobs abandoned by a crash or a killed dev server back to the queue. */
export function recoverStaleJobs(maxAgeMs = 30 * 60_000) {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    return getScoutDb()
        .prepare(`UPDATE jobs SET status = 'queued', locked_at = NULL WHERE status = 'running' AND locked_at < ?`)
        .run(cutoff).changes;
}

export function listJobs(limit = 25): JobRow[] {
    return getScoutDb()
        .prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as JobRow[];
}

export function countJobs(status: JobRow["status"]) {
    const row = getScoutDb().prepare(`SELECT COUNT(*) AS count FROM jobs WHERE status = ?`).get(status) as { count: number };
    return row.count;
}

export function hasQueuedJob(kind: JobKind) {
    const row = getScoutDb()
        .prepare(`SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'running') AND kind = ?`)
        .get(kind) as { count: number };
    return row.count > 0;
}
