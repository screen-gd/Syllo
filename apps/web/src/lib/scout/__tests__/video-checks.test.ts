import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeScoutDb, getScoutDb } from "@/lib/scout/db";
import type { TranscriptSegment } from "@/lib/scout/fetch/transcripts";
import {
    buildChecks,
    getVideoChecks,
    sourceExcerpt,
    splitIntoSections,
    type CheckDraft,
    type VideoChecksDeps,
} from "@/lib/scout/video-checks";

/** One ten-word line every ten seconds for `seconds`. */
function transcript(seconds: number): TranscriptSegment[] {
    return Array.from({ length: Math.floor(seconds / 10) }, (_, index) => ({
        text: `line ${index} one two three four five six seven eight`,
        start: index * 10,
        duration: 10,
    }));
}

const chapters = [
    { seconds: 0, label: "Intro" },
    { seconds: 120, label: "How it works" },
    { seconds: 300, label: "Pitfalls" },
];

let directory = "";

beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "syllo-video-checks-"));
    process.env.SCOUT_DB_PATH = join(directory, "checks.db");
});

afterAll(() => {
    closeScoutDb();
    rmSync(directory, { recursive: true, force: true });
});

describe("splitIntoSections", () => {
    it("follows chapters, starting the first at zero and ending the last at the video end", () => {
        const sections = splitIntoSections(transcript(420), chapters, 420);
        expect(sections.map((section) => [section.label, section.start, section.end, section.fromChapter])).toEqual([
            ["Intro", 0, 120, true],
            ["How it works", 120, 300, true],
            ["Pitfalls", 300, 420, true],
        ]);
        expect(sections[1].segments.every((segment) => segment.start >= 120 && segment.start < 300)).toBe(true);
    });

    it("cuts a video without chapters into three parts that do not pause playback", () => {
        const sections = splitIntoSections(transcript(600), [], null);
        expect(sections).toHaveLength(3);
        expect(sections.every((section) => !section.fromChapter)).toBe(true);
        expect(sections[2].end).toBe(600);
    });

    it("drops sections too short to ask about and renumbers the rest", () => {
        const sections = splitIntoSections(transcript(420), [{ seconds: 0, label: "Cold open" }, { seconds: 20, label: "Main" }], 420);
        expect(sections.map((section) => [section.index, section.label])).toEqual([[0, "Main"]]);
    });
});

describe("sourceExcerpt", () => {
    it("starts at the line containing the timestamp and stops after four lines", () => {
        const excerpt = sourceExcerpt(transcript(200), 34);
        expect(excerpt.start).toBe(30);
        expect(excerpt.lines).toHaveLength(4);
        expect(excerpt.lines[0]).toMatch(/^line 3 /);
    });
});

describe("buildChecks", () => {
    const sections = splitIntoSections(transcript(420), chapters, 420);

    it("keeps one question per section, uses the real transcript, and pauses at the chapter end", () => {
        const draft: CheckDraft = {
            checks: [
                { sectionIndex: 1, question: "Why does the second step matter?", answer: "Because it does.", evidenceSeconds: 150 },
                { sectionIndex: 1, question: "A duplicate question for the same part?", answer: "Ignored.", evidenceSeconds: 160 },
                { sectionIndex: 9, question: "A question for a section that is missing?", answer: "Ignored.", evidenceSeconds: 10 },
            ],
        };
        const checks = buildChecks(draft, sections, "vid");
        expect(checks).toHaveLength(1);
        expect(checks[0]).toMatchObject({ id: "vid:120", label: "How it works", pauseAt: 300, sourceStart: 150 });
        expect(checks[0].sourceLines[0]).toMatch(/^line 15 /);
    });

    it("falls back to the section start when the evidence time is outside the section", () => {
        const draft: CheckDraft = {
            checks: [{ sectionIndex: 2, question: "What goes wrong if you skip it?", answer: "It breaks.", evidenceSeconds: 5 }],
        };
        expect(buildChecks(draft, sections, "vid")[0].sourceStart).toBe(300);
    });
});

describe("getVideoChecks", () => {
    function fakeDeps(segments: TranscriptSegment[] | null) {
        const calls = { transcript: 0, generate: 0 };
        const deps: VideoChecksDeps = {
            db: getScoutDb,
            now: () => Date.parse("2026-11-01T00:00:00Z"),
            async readTranscript() {
                calls.transcript += 1;
                return segments ? { status: "ok", segments } : { status: "skipped", segments: [] };
            },
            async generate({ sections }) {
                calls.generate += 1;
                return {
                    checks: sections.map((section) => ({
                        sectionIndex: section.index,
                        question: `Why does ${section.label} matter?`,
                        answer: "It matters.",
                        evidenceSeconds: section.start,
                    })),
                };
            },
        };
        return { deps, calls };
    }

    it("reads the transcript and asks the model once, then serves the cache", async () => {
        const { deps, calls } = fakeDeps(transcript(420));
        const input = { videoId: "cached-video", title: "Demo", chapters, durationSeconds: 420 };
        const first = await getVideoChecks(input, deps);
        const second = await getVideoChecks(input, deps);
        expect(first.status).toBe("ready");
        expect(first.checks).toHaveLength(3);
        expect(second).toEqual(first);
        expect(calls).toEqual({ transcript: 1, generate: 1 });
    });

    it("reports a missing transcript without calling the model, and does not retry within a day", async () => {
        const { deps, calls } = fakeDeps(null);
        const input = { videoId: "silent-video", title: "Demo", chapters, durationSeconds: 420 };
        expect(await getVideoChecks(input, deps)).toEqual({ status: "no_transcript", checks: [] });
        expect(await getVideoChecks(input, deps)).toEqual({ status: "no_transcript", checks: [] });
        expect(calls).toEqual({ transcript: 1, generate: 0 });
    });
});
