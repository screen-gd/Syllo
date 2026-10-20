import OpenAI from "openai";
import { AiRequestOptions, AIProvider, DEFAULT_PROVIDER_MODELS, getAiProviderLabel, PROVIDER_BASE_URLS, PROVIDER_ENV_KEYS } from "@/lib/ai-config";

export const AI_MAX_INPUT_CHARS = 12_000;

export function truncateForAi(input: string, limit = AI_MAX_INPUT_CHARS) {
    if (input.length <= limit) return input;
    return `${input.slice(0, Math.max(0, limit - 24)).trimEnd()}\n\n[Content truncated for privacy]`;
}

function getProviderEnvApiKey(provider: AIProvider) {
    const envKey = PROVIDER_ENV_KEYS[provider];
    return process.env[envKey]?.trim() || "";
}

export function resolveAiRequestOptions(options?: AiRequestOptions) {
    const provider = options?.provider ?? "gemini";
    const model = options?.model?.trim() || DEFAULT_PROVIDER_MODELS[provider];
    const apiKey = options?.apiKey?.trim() || getProviderEnvApiKey(provider);

    if (!apiKey) {
        throw new Error(`${getAiProviderLabel(provider)} API key is not configured`);
    }

    return { apiKey, model, provider };
}

export function createAiClient(options?: AiRequestOptions) {
    const { apiKey, provider } = resolveAiRequestOptions(options);
    const baseURL = PROVIDER_BASE_URLS[provider];
    return new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey });
}

export const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
