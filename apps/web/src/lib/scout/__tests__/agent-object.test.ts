import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildObjectPrompt, collect } from "@/lib/scout/agent-runner";

describe("buildObjectPrompt", () => {
    it("carries the task, the text and the JSON schema", () => {
        const schema = z.object({
            summary: z.string(),
            score: z.number(),
        });

        const text = buildObjectPrompt({
            system: "You summarise study material.",
            prompt: "Transcript chunk goes here",
            schema,
        });

        expect(text).toContain("You summarise study material.");
        expect(text).toContain("Transcript chunk goes here");
        expect(text).toContain("summary");
        expect(text).toContain("score");
    });
});

describe("collect stdin", () => {
    it("writes input to the child's stdin", async () => {
        const result = await collect(
            process.execPath,
            ["-e", "process.stdin.pipe(process.stdout)"],
            { cwd: process.cwd(), timeoutMs: 15_000, input: "hello" },
        );

        expect(result.ok).toBe(true);
        expect(result.stdout).toBe("hello");
        expect(result.timedOut).toBe(false);
    });

    it("reports a command that does not exist as code null", async () => {
        const result = await collect("syllo-not-a-real-command-9f3c", [], {
            cwd: process.cwd(),
            timeoutMs: 15_000,
        });

        expect(result.code).toBeNull();
        expect(result.timedOut).toBe(false);
        expect(result.ok).toBe(false);
    });
});
