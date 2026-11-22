import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeScoutDb, getScoutDb } from "@/lib/scout/db";
import { getResourceRow, resetUnreadResource, saveResourceExtraction, upsertDiscoveredResource } from "@/lib/scout/pack";

let directory = "";

beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "syllo-scout-reset-"));
    process.env.SCOUT_DB_PATH = join(directory, "reset.db");
});

afterAll(() => {
    closeScoutDb();
    rmSync(directory, { recursive: true, force: true });
    delete process.env.SCOUT_DB_PATH;
});

function freshRow(id: string) {
    const row = getResourceRow(id);
    if (!row) throw new Error(`resource ${id} missing`);
    return row;
}

describe("resetUnreadResource", () => {
    it("returns a failed read to pending so the next pack retries it", () => {
        const created = upsertDiscoveredResource({
            kind: "video",
            source: "youtube",
            externalId: "failed-video1",
            url: "https://www.youtube.com/watch?v=failed-video1",
            title: "Unread video",
        });
        saveResourceExtraction(created.id, {
            summary: "Scout could not read this source. It remains available as a manual link.",
            keyPoints: [],
            skillTags: [],
            chapters: [],
            transcriptStatus: "skipped",
            transcriptChars: 0,
            error: "No transcript available",
        });

        const reset = resetUnreadResource(freshRow(created.id));

        expect(reset.transcript_status).toBe("pending");
        expect(reset.summary).toBeNull();
        expect(reset.error).toBeNull();
        expect(freshRow(created.id).transcript_status).toBe("pending");
    });

    it("leaves a successfully read resource cached", () => {
        const created = upsertDiscoveredResource({
            kind: "video",
            source: "youtube",
            externalId: "read-video22",
            url: "https://www.youtube.com/watch?v=read-video22",
            title: "Readable video",
        });
        saveResourceExtraction(created.id, {
            summary: "A real summary.",
            keyPoints: [],
            skillTags: [],
            chapters: [],
            transcriptStatus: "ok",
            transcriptChars: 400,
        });
        const row = freshRow(created.id);

        const reset = resetUnreadResource(row);

        expect(reset).toBe(row);
        expect(reset.transcript_status).toBe("ok");
        expect(reset.summary).toBe("A real summary.");
    });

    it("leaves a skipped row with no error alone, such as a manual link", () => {
        const created = upsertDiscoveredResource({
            kind: "video",
            source: "manual",
            externalId: "manual-link3",
            url: "https://www.youtube.com/watch?v=manual-link3",
            title: "Manually added video",
        });
        getScoutDb().prepare(`UPDATE resources SET transcript_status = 'skipped' WHERE id = ?`).run(created.id);
        const row = freshRow(created.id);

        const reset = resetUnreadResource(row);

        expect(reset).toBe(row);
        expect(reset.transcript_status).toBe("skipped");
        expect(freshRow(created.id).transcript_status).toBe("skipped");
    });
});
