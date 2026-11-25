import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const directory = mkdtempSync(join(tmpdir(), "syllo-scout-llm-agent-"));
process.env.SCOUT_DB_PATH = join(directory, "llm-agent.db");

vi.mock("../agent-runner", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../agent-runner")>();
    return { ...actual, runAgentObject: vi.fn() };
});

import { AgentError, runAgentObject } from "../agent-runner";
import { closeScoutDb, getScoutDb } from "../db";
import { resolveScoutLlm, scoutGenerateObject, scoutLlmFromBody, ScoutError } from "../llm";
import { createPack } from "../pack";

const schema = z.object({ answer: z.string() });
const input = (config: Parameters<typeof scoutGenerateObject>[0]["config"]) => ({
    schema,
    system: "sys",
    prompt: "p",
    config,
});

let geminiKey: string | undefined;

beforeAll(() => {
    geminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
});

afterAll(() => {
    if (geminiKey !== undefined) process.env.GEMINI_API_KEY = geminiKey;
    closeScoutDb();
    rmSync(directory, { recursive: true, force: true });
    delete process.env.SCOUT_DB_PATH;
});

beforeEach(() => {
    vi.mocked(runAgentObject).mockReset();
});

describe("scoutGenerateObject with a local agent", () => {
    it("reads through the agent without a Gemini key and logs the spend", async () => {
        vi.mocked(runAgentObject).mockResolvedValue({ answer: "ok" } as never);
        const pack = createPack("agent smoke");

        const result = await scoutGenerateObject({ ...input({ agent: "claude" }), packId: pack.id });

        expect(result.object).toEqual({ answer: "ok" });
        const rows = getScoutDb()
            .prepare(`SELECT provider, model FROM spend_log WHERE pack_id = ?`)
            .all(pack.id) as Array<{ provider: string; model: string }>;
        expect(rows).toEqual([{ provider: "claude", model: "cli" }]);
    });

    it("maps a missing agent to config and every other failure to provider", async () => {
        vi.mocked(runAgentObject).mockRejectedValue(new AgentError("missing", "claude", "not installed"));
        await expect(scoutGenerateObject(input({ agent: "claude" }))).rejects.toMatchObject({
            name: "ScoutError",
            code: "config",
        } satisfies Partial<ScoutError>);

        vi.mocked(runAgentObject).mockRejectedValue(new AgentError("timeout", "claude", "too slow"));
        await expect(scoutGenerateObject(input({ agent: "claude" }))).rejects.toMatchObject({
            name: "ScoutError",
            code: "provider",
        } satisfies Partial<ScoutError>);

        vi.mocked(runAgentObject).mockRejectedValue(new AgentError("bad_answer", "claude", "no json"));
        await expect(scoutGenerateObject(input({ agent: "claude" }))).rejects.toMatchObject({
            name: "ScoutError",
            code: "provider",
        } satisfies Partial<ScoutError>);
    });
});

describe("resolveScoutLlm agent choice", () => {
    const previousAgent = process.env.SCOUT_AGENT;

    afterAll(() => {
        if (previousAgent === undefined) delete process.env.SCOUT_AGENT;
        else process.env.SCOUT_AGENT = previousAgent;
    });

    it("uses the env agent, an explicit null, or the request key", () => {
        process.env.SCOUT_AGENT = "codex";
        expect(resolveScoutLlm().agent).toBe("codex");
        expect(resolveScoutLlm({ agent: null }).agent).toBeNull();
        expect(resolveScoutLlm({ apiKey: "x" }).agent).toBeNull();
        expect(resolveScoutLlm({ agent: "opencode" }).agent).toBe("opencode");

        delete process.env.SCOUT_AGENT;
        expect(resolveScoutLlm().agent).toBeNull();
    });
});

describe("scoutLlmFromBody", () => {
    it("reads the three agent rules", () => {
        expect(scoutLlmFromBody({ agent: "claude" })).toEqual({
            provider: "gemini",
            model: "gemini-3.5-flash-lite",
            agent: "claude",
        });

        expect(
            scoutLlmFromBody({ agent: "gemini", apiKey: "key-1", provider: "gemini", model: "gemini-3.8-flash" }),
        ).toEqual({
            provider: "gemini",
            model: "gemini-3.8-flash",
            apiKey: "key-1",
            agent: null,
        });

        expect(scoutLlmFromBody({ agent: "gemini" })).toEqual({ agent: null });
    });

    it("keeps the old key-only behaviour when agent is absent", () => {
        expect(scoutLlmFromBody({ apiKey: "key-2", model: "gemini-3.8-flash" })).toEqual({
            provider: "gemini",
            model: "gemini-3.8-flash",
            apiKey: "key-2",
        });
        expect(scoutLlmFromBody({ apiKey: "  " })).toBeNull();
        expect(scoutLlmFromBody({})).toBeNull();
        expect(scoutLlmFromBody(null)).toBeNull();
    });
});
