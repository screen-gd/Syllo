import crossSpawn from "cross-spawn";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { ScoutAgentConnection, ScoutAgentStatus } from "./types";

/**
 * Scout can hand one bounded research task to a coding agent the learner
 * already has installed. Agents run as child processes with an explicit
 * working directory, a timeout, no shell, and no approval-bypass flags.
 *
 * The other direction (agent -> Scout) is mcp/server.mjs: the learner points
 * their agent at that file and it can add or search library resources.
 */

export type AgentId = "opencode" | "codex" | "claude";

interface AgentDefinition {
    id: AgentId;
    label: string;
    command: string;
    /** Print mode, prompt as one argv entry. Never a shell string. */
    args: (prompt: string) => string[];
}

const AGENTS: AgentDefinition[] = [
    {
        id: "opencode",
        label: "opencode",
        command: "opencode",
        args: (prompt) => ["run", prompt],
    },
    {
        id: "codex",
        label: "Codex",
        command: "codex",
        args: (prompt) => ["exec", "--sandbox", "read-only", prompt],
    },
    {
        id: "claude",
        label: "Claude Code",
        command: "claude",
        args: (prompt) => ["-p", prompt],
    },
];

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_PROMPT_CHARS = 20_000;

function messageOf(error: unknown) {
    return error instanceof Error && error.message ? error.message : "Unknown agent error";
}

function truncate(value: string, max = 800) {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

interface SpawnResult {
    ok: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}

function collect(
    command: string,
    args: string[],
    options: { cwd: string; timeoutMs: number; maxBytes?: number },
): Promise<SpawnResult> {
    const maxBytes = options.maxBytes ?? MAX_OUTPUT_BYTES;

    return new Promise<SpawnResult>((resolvePromise) => {
        let settled = false;
        let stdout = "";
        let stderr = "";
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let timedOut = false;

        const finish = (ok: boolean, code: number | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({ ok, code, stdout, stderr, timedOut });
        };

        let child: ReturnType<typeof crossSpawn>;
        try {
            child = crossSpawn(command, args, {
                cwd: options.cwd,
                shell: false,
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"],
                env: process.env,
            });
        } catch (error) {
            stderr = messageOf(error);
            resolvePromise({ ok: false, code: null, stdout: "", stderr, timedOut: false });
            return;
        }

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
            // A shim can ignore the first signal; release the waiter regardless.
            setTimeout(() => finish(false, null), 2_000);
        }, options.timeoutMs);

        child.stdout?.on("data", (chunk: Buffer) => {
            if (stdoutBytes >= maxBytes) return;
            const text = chunk.toString("utf8");
            stdout += text.slice(0, maxBytes - stdoutBytes);
            stdoutBytes += Buffer.byteLength(text);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
            if (stderrBytes >= maxBytes) return;
            const text = chunk.toString("utf8");
            stderr += text.slice(0, maxBytes - stderrBytes);
            stderrBytes += Buffer.byteLength(text);
        });

        child.on("error", (error) => {
            stderr = stderr || messageOf(error);
            finish(false, null);
        });

        child.on("close", (code) => {
            finish(code === 0, code);
        });
    });
}

function definitionOf(id: AgentId) {
    const definition = AGENTS.find((agent) => agent.id === id);
    if (!definition) throw new Error(`Unknown agent: ${id}`);
    return definition;
}

export async function probeAgent(id: AgentId): Promise<ScoutAgentStatus> {
    const definition = definitionOf(id);
    const result = await collect(definition.command, ["--version"], {
        cwd: process.cwd(),
        timeoutMs: 4_000,
        maxBytes: 64_000,
    });

    const versionLine = (result.stdout || result.stderr)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

    return {
        id: definition.id,
        label: definition.label,
        available: result.ok,
        version: result.ok && versionLine ? versionLine.slice(0, 80) : null,
        command: definition.command,
    };
}

export async function agentStatuses(): Promise<ScoutAgentStatus[]> {
    return Promise.all(AGENTS.map((agent) => probeAgent(agent.id)));
}

export interface RunAgentOptions {
    cwd?: string;
    timeoutMs?: number;
}

export async function runAgent(id: AgentId, prompt: string, options: RunAgentOptions = {}): Promise<string> {
    const definition = definitionOf(id);
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) throw new Error("The prompt is empty");
    if (cleanPrompt.length > MAX_PROMPT_CHARS) throw new Error("The prompt is too long");

    const cwd = resolve(options.cwd?.trim() || process.cwd());
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
        throw new Error(`Agent working directory does not exist: ${cwd}`);
    }

    const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(5_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    const result = await collect(definition.command, definition.args(cleanPrompt), { cwd, timeoutMs });

    if (result.timedOut) {
        throw new Error(`${definition.label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    if (!result.ok) {
        const detail = truncate(result.stderr || result.stdout);
        throw new Error(detail ? `${definition.label} failed: ${detail}` : `${definition.label} exited with code ${result.code}`);
    }

    const output = result.stdout.trim();
    if (!output) throw new Error(`${definition.label} returned no output`);
    return output;
}

/** Agents like to wrap JSON in prose or fences. Take the outer object. */
export function extractJsonObject(output: string): unknown {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("The agent did not return a JSON object");
    }

    try {
        return JSON.parse(output.slice(start, end + 1));
    } catch {
        throw new Error("The agent returned invalid JSON");
    }
}

export async function runAgentJson<T>(
    id: AgentId,
    prompt: string,
    schema: z.ZodType<T>,
    options: RunAgentOptions = {},
): Promise<T> {
    const output = await runAgent(id, prompt, options);
    const parsed = schema.safeParse(extractJsonObject(output));
    if (!parsed.success) {
        throw new Error(`The agent returned data Scout could not use: ${parsed.error.issues[0]?.message ?? "invalid shape"}`);
    }
    return parsed.data;
}

export const agentResourcesSchema = z.object({
    resources: z
        .array(
            z.object({
                title: z.string().min(1).max(200),
                url: z.url(),
                note: z.string().max(400).optional(),
                skill: z.string().max(60).optional(),
            }),
        )
        .min(1)
        .max(12),
});

export type AgentResources = z.infer<typeof agentResourcesSchema>;

export function buildResearchPrompt(goal: string) {
    return [
        "You are helping Syllo Scout find free learning resources for one goal.",
        `Goal: ${goal.trim()}`,
        "",
        "Rules:",
        "- Find up to 8 free, publicly accessible resources: videos, articles or documentation.",
        "- No paid courses, no books, no login walls, no pirated material.",
        "- Prefer primary sources and recent material.",
        "- Return ONLY a JSON object, with no prose and no code fences, in this shape:",
        '{"resources":[{"title":"...","url":"https://...","note":"why it helps","skill":"short skill name"}]}',
    ].join("\n");
}

export async function pickAgent(preferred?: AgentId | null): Promise<ScoutAgentStatus> {
    const statuses = await agentStatuses();
    const chosen =
        (preferred ? statuses.find((agent) => agent.id === preferred && agent.available) : undefined) ??
        statuses.find((agent) => agent.available);

    if (!chosen) {
        throw new Error("No agent CLI found. Install opencode, Codex or Claude Code, then reopen Settings.");
    }
    return chosen;
}

export async function researchWithAgent(goal: string, preferred?: AgentId | null) {
    const agent = await pickAgent(preferred);
    const result = await runAgentJson(agent.id, buildResearchPrompt(goal), agentResourcesSchema, {
        timeoutMs: 120_000,
    });

    const seen = new Set<string>();
    const resources = result.resources.filter((resource) => {
        const key = resource.url.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return { agent, resources };
}

/**
 * Copy-paste MCP registration for each agent. Paths are absolute so the agent
 * does not have to start in the Syllo repo.
 */
export function agentConnections(): ScoutAgentConnection[] {
    const serverPath = resolve(process.cwd(), "mcp", "server.mjs");
    const dbPath = resolve(process.env.SCOUT_DB_PATH?.trim() || resolve(process.cwd(), ".data", "syllo.db"));

    const opencode = {
        $schema: "https://opencode.ai/config.json",
        mcp: {
            "syllo-scout": {
                type: "local",
                command: ["node", serverPath],
                environment: { SCOUT_DB_PATH: dbPath },
                enabled: true,
            },
        },
    };

    const claude = {
        mcpServers: {
            "syllo-scout": {
                command: "node",
                args: [serverPath],
                env: { SCOUT_DB_PATH: dbPath },
            },
        },
    };

    const codex = [
        "[mcp_servers.syllo-scout]",
        'command = "node"',
        `args = [${JSON.stringify(serverPath)}]`,
        `env = { SCOUT_DB_PATH = ${JSON.stringify(dbPath)} }`,
    ].join("\n");

    return [
        {
            id: "opencode",
            label: "opencode",
            file: "opencode.json",
            snippet: JSON.stringify(opencode, null, 2),
            note: "Project or global opencode config. Restart opencode after saving.",
        },
        {
            id: "codex",
            label: "Codex",
            file: "~/.codex/config.toml",
            snippet: codex,
            note: "Codex CLI and the Codex IDE extension read this file.",
        },
        {
            id: "claude",
            label: "Claude Code",
            file: ".mcp.json",
            snippet: JSON.stringify(claude, null, 2),
            note: "Run `claude mcp list` to confirm the server is connected.",
        },
        {
            id: "chatgpt",
            label: "ChatGPT",
            file: "ChatGPT desktop",
            snippet: `node ${serverPath}`,
            note: "ChatGPT connectors expect a remote MCP URL. Run the same tools locally through Codex, or expose this stdio server through your own tunnel.",
        },
    ];
}
