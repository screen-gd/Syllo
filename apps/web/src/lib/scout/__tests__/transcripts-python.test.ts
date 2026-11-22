import { beforeEach, describe, expect, it, vi } from "vitest";

type SpawnResult = { stdout: string; stderr: string };
type SpawnCallback = (error: Error | null, result?: SpawnResult) => void;

const mocks = vi.hoisted(() => ({
    impl(_command: string, _args: string[], _options: unknown, callback: SpawnCallback) {
        callback(new Error("impl not configured"));
    },
}));

vi.mock("node:child_process", () => ({
    execFile: (command: string, args: string[], options: unknown, callback: SpawnCallback) =>
        mocks.impl(command, args, options, callback),
}));

import { fetchTranscript } from "@/lib/scout/fetch/transcripts";
import { SOURCE_COPY } from "@/lib/scout/source-copy";

const CANDIDATES_KEY = Symbol.for("syllo.scout.pythonTranscript");

function respondWith(result?: SpawnResult, error?: Error) {
    mocks.impl = (_command: string, _args: string[], _options: unknown, callback: SpawnCallback) => {
        if (error) callback(error);
        else callback(null, result);
    };
}

beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[CANDIDATES_KEY];
});

describe("fetchTranscript without a working Python", () => {
    it("names the missing helper when youtube-transcript-api is not installed", async () => {
        respondWith({
            stdout: `${JSON.stringify({ ok: false, reason: "missing_module", error: "No module named 'youtube_transcript_api'" })}\n`,
            stderr: "",
        });

        const result = await fetchTranscript("dQw4w9WgXcQ");

        expect(result.status).toBe("skipped");
        expect(result.error).toBe(SOURCE_COPY.noTranscriptHelper);
    });

    it("names a missing interpreter when no Python command launches", async () => {
        respondWith(undefined, new Error("spawn python ENOENT"));

        const result = await fetchTranscript("dQw4w9WgXcQ");

        expect(result.status).toBe("skipped");
        expect(result.error).toBe(SOURCE_COPY.noPython);
    });
});
