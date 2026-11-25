import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { assertFreeAi } from "@/lib/ai-policy";
import {
    DEFAULT_PROVIDER_MODELS,
    isAiProvider,
    PROVIDER_ENV_KEYS,
    type AIProvider,
} from "@/lib/ai-config";
import { AgentError, isAgentId, runAgentObject, type AgentId } from "./agent-runner";
import { getScoutSettings } from "./settings";
import { hasBudget, monthSpendCents, recordSpend } from "./spend";

export interface ScoutLlmConfig {
    provider: AIProvider;
    model: string;
    apiKey?: string | null;
    agent?: AgentId | null;
}

export class ScoutError extends Error {
    code: "budget" | "config" | "provider" | "quota";

    constructor(code: ScoutError["code"], message: string) {
        super(message);
        this.name = "ScoutError";
        this.code = code;
    }
}

/**
 * Packs hold their provider choice for the life of the run. The API key is
 * kept in process memory only: it is never written to SQLite or returned by
 * an endpoint, and a restart simply asks the user to start again.
 */
const globalKey = Symbol.for("syllo.scout.llm");

type GlobalWithSecrets = typeof globalThis & { [globalKey]?: Map<string, ScoutLlmConfig> };

function secretStore() {
    const store = globalThis as GlobalWithSecrets;
    store[globalKey] ??= new Map();
    return store[globalKey];
}

export function defaultScoutConfig(): ScoutLlmConfig {
    const envProvider = process.env.SCOUT_PROVIDER?.trim();
    const provider: AIProvider = isAiProvider(envProvider) ? envProvider : "gemini";
    const envAgent = process.env.SCOUT_AGENT?.trim();
    return {
        provider,
        model: process.env.SCOUT_MODEL?.trim() || DEFAULT_PROVIDER_MODELS[provider],
        agent: isAgentId(envAgent) ? envAgent : null,
    };
}

/**
 * Holds what the request supplied for the life of a pack: the chosen agent,
 * a browser key if one was sent, and resolved provider/model defaults. An
 * env key is looked up per call and never stored here.
 */
export function rememberScoutLlm(packId: string, config: Partial<ScoutLlmConfig>) {
    const base = defaultScoutConfig();
    const provider = config.provider && isAiProvider(config.provider) ? config.provider : base.provider;
    const model = config.model?.trim() || (provider === base.provider ? base.model : DEFAULT_PROVIDER_MODELS[provider]);
    secretStore().set(packId, {
        provider,
        model,
        apiKey: config.apiKey?.trim() || null,
        agent: config.agent,
    });
}

export function recallScoutLlm(packId: string): ScoutLlmConfig | null {
    return secretStore().get(packId) ?? null;
}

export function forgetScoutLlm(packId: string) {
    secretStore().delete(packId);
}

export function resolveScoutLlm(override?: Partial<ScoutLlmConfig> | null): ScoutLlmConfig {
    const base = defaultScoutConfig();
    const provider = override?.provider && isAiProvider(override.provider) ? override.provider : base.provider;
    const model = override?.model?.trim() || (provider === base.provider ? base.model : DEFAULT_PROVIDER_MODELS[provider]);
    const apiKey = override?.apiKey?.trim() || process.env[PROVIDER_ENV_KEYS[provider]]?.trim() || "";
    // An explicit agent choice or a request-supplied key wins; otherwise the
    // env default applies when no key was supplied.
    const agent = override?.agent !== undefined
        ? override.agent
        : override?.apiKey?.trim()
            ? null
            : base.agent;
    return { provider, model, apiKey, agent };
}

/**
 * Turns the optional llm fields on a request body into a config override.
 * `agent` picks a local coding agent, `agent: "gemini"` means the key path,
 * and no `agent` field keeps the old key-only behaviour.
 */
export function scoutLlmFromBody(
    body: { provider?: unknown; model?: unknown; apiKey?: unknown; agent?: unknown } | null | undefined,
): Partial<ScoutLlmConfig> | null {
    const fromKey = (): Partial<ScoutLlmConfig> | null => {
        if (typeof body?.apiKey !== "string" || !body.apiKey.trim()) return null;
        const provider = isAiProvider(body.provider) ? body.provider : defaultScoutConfig().provider;
        return {
            provider,
            model:
                typeof body.model === "string" && body.model.trim()
                    ? body.model.trim()
                    : DEFAULT_PROVIDER_MODELS[provider],
            apiKey: body.apiKey.trim(),
        };
    };

    if (isAgentId(body?.agent)) {
        return { provider: "gemini", model: DEFAULT_PROVIDER_MODELS.gemini, agent: body.agent };
    }
    if (body?.agent === "gemini") {
        return { ...fromKey(), agent: null };
    }
    return fromKey();
}

export interface ScoutGenerateInput<T> {
    packId?: string | null;
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
    config?: Partial<ScoutLlmConfig> | null;
}

export interface ScoutGenerateResult<T> {
    object: T;
    inputTokens: number;
    outputTokens: number;
}

/**
 * One structured generation. Free Gemini stops at quota exhaustion with no
 * provider fallback; a chosen local agent reads on the learner's own CLI
 * subscription instead, skipping the key, policy and quota checks entirely.
 */
export async function scoutGenerateObject<T>(input: ScoutGenerateInput<T>): Promise<ScoutGenerateResult<T>> {
    const settings = getScoutSettings();
    if (!hasBudget(settings.monthlyBudgetCents)) {
        throw new ScoutError(
            "budget",
            `Scout reached its monthly budget of $${(settings.monthlyBudgetCents / 100).toFixed(2)} (spent $${(monthSpendCents() / 100).toFixed(2)}). Raise the budget in Scout settings to continue.`,
        );
    }

    const stored = input.packId ? recallScoutLlm(input.packId) : null;
    const config = resolveScoutLlm({ ...stored, ...input.config });

    if (config.agent) {
        try {
            const object = await runAgentObject({
                agent: config.agent,
                system: input.system,
                prompt: input.prompt,
                schema: input.schema,
            });
            recordSpend({
                packId: input.packId ?? null,
                provider: config.agent,
                model: "cli",
                inputTokens: 0,
                outputTokens: 0,
            });
            return { object, inputTokens: 0, outputTokens: 0 };
        } catch (error) {
            if (error instanceof AgentError) {
                throw new ScoutError(error.kind === "missing" ? "config" : "provider", error.message);
            }
            throw error;
        }
    }

    if (!config.apiKey) {
        throw new ScoutError(
            "config",
            `Scout needs a free Gemini API key. Add one in Settings or set GEMINI_API_KEY on the local worker.`,
        );
    }

    assertFreeAi(config.provider, config.model);
    assertScoutQuota();
    const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });

    try {
        const result = await generateObject({
            model: provider(config.model),
            schema: input.schema,
            system: input.system,
            prompt: input.prompt,
            temperature: 0.2,
            maxRetries: 0,
        });

        const inputTokens = result.usage?.inputTokens ?? 0;
        const outputTokens = result.usage?.outputTokens ?? 0;

        recordSpend({
            packId: input.packId ?? null,
            provider: config.provider,
            model: config.model,
            inputTokens,
            outputTokens,
        });

        return { object: input.schema.parse(result.object), inputTokens, outputTokens };
    } catch (error) {
        if (error instanceof ScoutError) throw error;
        const status = z.object({ statusCode: z.number() }).safeParse(error);
        if (status.success && status.data.statusCode === 429) {
            pauseScoutQuota();
            throw new ScoutError("quota", "The free Gemini quota is exhausted. Scout has paused. Your existing books, notes, and learning remain available; try again later or add resources manually.");
        }
        const message = error instanceof Error ? error.message : "Unknown provider error";
        throw new ScoutError("provider", `Scout could not reach ${config.provider}: ${message.slice(0, 300)}`);
    }
}

let pausedUntil = 0;
export function assertScoutQuota() {
    if (Date.now() < pausedUntil) throw new ScoutError("quota", "Scout is paused after reaching the free Gemini quota. Try again later, or add resources manually.");
}
export function pauseScoutQuota() { pausedUntil = Date.now() + 15 * 60_000; }
