import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeScoutDb } from "@/lib/scout/db";
import {
    claimNextJob,
    completeJob,
    countJobs,
    deferJob,
    enqueueJob,
    failJob,
    getJob,
    hasQueuedJob,
    JobDeferred,
    recoverStaleJobs,
} from "@/lib/scout/jobs";

let directory = "";

beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "syllo-scout-jobs-"));
    process.env.SCOUT_DB_PATH = join(directory, "jobs.db");
});

afterAll(() => {
    closeScoutDb();
    rmSync(directory, { recursive: true, force: true });
});

describe("Scout job queue", () => {
    it("claims the oldest due job and completes it", () => {
        const first = enqueueJob("discover", { packId: "one" }, { runAfter: new Date("2026-10-01T00:00:00Z") });
        const second = enqueueJob("discover", { packId: "two" }, { runAfter: new Date("2026-10-02T00:00:00Z") });

        const claimed = claimNextJob(new Date("2026-10-01T12:00:00Z"));
        expect(claimed?.id).toBe(first);
        expect(claimed?.status).toBe("running");
        expect(claimed?.attempts).toBe(1);

        completeJob(first, { found: 3 });
        expect(getJob(first)?.status).toBe("done");
        expect(getJob(first)?.result).toBe(JSON.stringify({ found: 3 }));

        expect(claimNextJob(new Date("2026-10-01T12:00:00Z"))).toBeNull();
        expect(claimNextJob(new Date("2026-10-02T12:00:00Z"))?.id).toBe(second);
    });

    it("defers a job without spending an attempt", () => {
        const id = enqueueJob("process_resource", { packId: "pack" }, { runAfter: new Date("2026-10-01T00:00:00Z") });
        const claimed = claimNextJob(new Date("2026-10-01T00:00:01Z"));
        expect(claimed?.id).toBe(id);
        expect(claimed?.attempts).toBe(1);

        deferJob(id, 60_000, "transcript throttle");
        const deferred = getJob(id);
        expect(deferred?.status).toBe("queued");
        expect(deferred?.attempts).toBe(0);
        expect(deferred?.error).toBe("transcript throttle");
        expect(claimNextJob(new Date())).toBeNull();
        const reclaimed = claimNextJob(new Date(Date.now() + 120_000));
        expect(reclaimed?.id).toBe(id);
        completeJob(id, {});
    });

    it("retries with backoff until max attempts, then fails", () => {
        const id = enqueueJob("discover", {}, { maxAttempts: 2, runAfter: new Date("2026-10-01T00:00:00Z") });

        expect(claimNextJob(new Date("2026-10-01T00:00:01Z"))?.attempts).toBe(1);
        failJob(id, new Error("provider down"));
        expect(getJob(id)?.status).toBe("queued");
        expect(getJob(id)?.error).toBe("provider down");

        const later = new Date(Date.now() + 3_600_000);
        expect(claimNextJob(later)?.attempts).toBe(2);
        failJob(id, new Error("still down"));

        const failed = getJob(id);
        expect(failed?.status).toBe("failed");
        expect(failed?.error).toBe("still down");
        expect(countJobs("failed")).toBe(1);
    });

    it("recovers jobs abandoned while running", () => {
        const id = enqueueJob("build_workspace", {}, { runAfter: new Date("2026-10-01T00:00:00Z") });
        expect(claimNextJob(new Date("2026-10-01T00:00:01Z"))?.id).toBe(id);
        expect(getJob(id)?.status).toBe("running");

        expect(recoverStaleJobs(-1_000)).toBeGreaterThanOrEqual(1);
        expect(getJob(id)?.status).toBe("queued");
    });

    it("tracks queued work by kind and clamps a negative defer delay", () => {
        enqueueJob("auto_check");
        expect(hasQueuedJob("auto_check")).toBe(true);
        expect(hasQueuedJob("discover")).toBe(true);

        const deferred = new JobDeferred(-50);
        expect(deferred.delayMs).toBe(0);
    });
});
