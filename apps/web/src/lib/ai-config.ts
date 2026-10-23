export type AIProvider = "openai" | "gemini" | "groq" | "deepseek" | "openrouter";

export interface AiRequestOptions {
    apiKey?: string | null;
    model?: string | null;
    provider?: AIProvider | null;
}

export const AI_PROVIDER_OPTIONS: Array<{
    description: string;
    label: string;
    value: AIProvider;
}> = [
    {
        value: "openai",
        label: "OpenAI",
        description: "Use OpenAI directly with the studio default provider.",
    },
    {
        value: "gemini",
        label: "Gemini",
        description: "Use Google Gemini through the official OpenAI-compatible endpoint.",
    },
    {
        value: "groq",
        label: "Groq",
        description: "Use Groq with fast OpenAI-compatible chat completions.",
    },
    {
        value: "deepseek",
        label: "DeepSeek",
        description: "Use DeepSeek directly through its OpenAI-compatible API.",
    },
    {
        value: "openrouter",
        label: "OpenRouter",
        description: "Route requests through OpenRouter and choose from multiple upstream models.",
    },
];

export const DEFAULT_PROVIDER_MODELS: Record<AIProvider, string> = {
    openai: "gpt-5.4",
    gemini: "gemini-2.5-flash",
    groq: "llama-3.3-70b-versatile",
    deepseek: "deepseek-chat",
    openrouter: "openai/gpt-4.1-mini",
};

export const PROVIDER_MODEL_PRESETS: Record<AIProvider, string[]> = {
    openai: ["gpt-5.4"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
    groq: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    openrouter: ["openai/gpt-4.1-mini", "google/gemini-2.5-flash"],
};

export const PROVIDER_BASE_URLS: Partial<Record<AIProvider, string>> = {
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
    groq: "https://api.groq.com/openai/v1",
    deepseek: "https://api.deepseek.com",
    openrouter: "https://openrouter.ai/api/v1",
};

export const PROVIDER_ENV_KEYS: Record<AIProvider, string> = {
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
};

export const PROVIDER_KEY_PLACEHOLDERS: Record<AIProvider, string> = {
    openai: "sk-...",
    gemini: "AIza...",
    groq: "gsk_...",
    deepseek: "sk-...",
    openrouter: "sk-or-...",
};

export const PROVIDER_KEY_LABELS: Record<AIProvider, string> = {
    openai: "OpenAI API key",
    gemini: "Gemini API key",
    groq: "Groq API key",
    deepseek: "DeepSeek API key",
    openrouter: "OpenRouter API key",
};

const AI_PROVIDER_SET = new Set<AIProvider>(AI_PROVIDER_OPTIONS.map((option) => option.value));

export function isAiProvider(value: unknown): value is AIProvider {
    return typeof value === "string" && AI_PROVIDER_SET.has(value as AIProvider);
}

export function getAiProviderLabel(provider: AIProvider | null | undefined): string {
    return provider ? AI_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? "Selected provider" : "Selected provider";
}

export function getAiProviderKeyLabel(provider: AIProvider | null | undefined): string {
    return provider ? PROVIDER_KEY_LABELS[provider] : "API key";
}

export function getAiProviderInvalidKeyMessage(provider: AIProvider | null | undefined): string {
    return `The selected ${getAiProviderKeyLabel(provider)} is invalid or expired. Update it in Settings.`;
}
