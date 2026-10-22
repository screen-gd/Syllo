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
import { getScoutSettings } from "./settings";
import { hasBudget, monthSpendCents, recordSpend } from "./spend";

export interface ScoutLlmConfig {
    provider: AIProvider;
    model: string;
    apiKey?: string | null;
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
    return {
        provider,
        model: process.env.SCOUT_MODEL?.trim() || DEFAULT_PROVIDER_MODELS[provider],
    };
}

export function rememberScoutLlm(packId: string, config: ScoutLlmConfig) {
    secretStore().set(packId, { ...config, apiKey: config.apiKey?.trim() || null });
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
    return { provider, model, apiKey };
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
 * Free Gemini generation stops at quota exhaustion, with no provider fallback.
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
