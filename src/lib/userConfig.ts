import { AIProvider, DEFAULT_PROVIDER_MODELS, isAiProvider } from "@/lib/ai-config";

export type ProviderMap = Record<AIProvider, string>;

export interface UserConfig {
    apiKeys: ProviderMap;
    modelByProvider: ProviderMap;
    provider: AIProvider;
    useCustomKey: boolean;
    theme: "dark";
    accentColor: string;
    showProgressNotice: boolean;
    measurementStyle: "tasks" | "time" | "both";
    visualDensity: "default" | "compact";
}

const STORAGE_KEY = "zns_user_config";
const AI_PROVIDERS = Object.keys(DEFAULT_PROVIDER_MODELS) as AIProvider[];

function createProviderMap(defaultValue: string): ProviderMap {
    return AI_PROVIDERS.reduce((accumulator, provider) => {
        accumulator[provider] = defaultValue;
        return accumulator;
    }, {} as ProviderMap);
}

export const DEFAULT_CONFIG: UserConfig = {
    apiKeys: createProviderMap(""),
    modelByProvider: { ...DEFAULT_PROVIDER_MODELS },
    provider: "gemini",
    useCustomKey: false,
    theme: "dark",
    accentColor: "#4F7CFF",
    showProgressNotice: true,
    measurementStyle: "tasks",
    visualDensity: "default",
};

export function getUserConfig(): UserConfig {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;
    try {
        const parsed = JSON.parse(stored) as Partial<UserConfig> & {
            apiKey?: string;
            apiKeys?: Partial<ProviderMap>;
            model?: string;
            modelByProvider?: Partial<ProviderMap>;
            provider?: string;
        };
        const provider = isAiProvider(parsed.provider) ? parsed.provider : DEFAULT_CONFIG.provider;
        const legacyApiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
        const apiKeys = AI_PROVIDERS.reduce((accumulator, currentProvider) => {
            const storedKey = parsed.apiKeys?.[currentProvider];
            accumulator[currentProvider] = typeof storedKey === "string"
                ? storedKey
                : currentProvider === "gemini"
                    ? legacyApiKey
                    : DEFAULT_CONFIG.apiKeys[currentProvider];
            return accumulator;
        }, createProviderMap(""));
        const legacyModel = typeof parsed.model === "string" && parsed.model.trim().length > 0 ? parsed.model.trim() : "";
        const modelByProvider = AI_PROVIDERS.reduce((accumulator, currentProvider) => {
            const storedModel = parsed.modelByProvider?.[currentProvider];
            accumulator[currentProvider] = currentProvider === provider && legacyModel
                ? legacyModel
                : typeof storedModel === "string" && storedModel.trim().length > 0
                    ? storedModel.trim()
                    : DEFAULT_CONFIG.modelByProvider[currentProvider];
            return accumulator;
        }, createProviderMap(""));

        return {
            ...DEFAULT_CONFIG,
            apiKeys,
            modelByProvider,
            provider,
            useCustomKey: Boolean(parsed.useCustomKey && apiKeys[provider]),
            theme: "dark",
            accentColor: typeof parsed.accentColor === "string" ? parsed.accentColor : DEFAULT_CONFIG.accentColor,
            showProgressNotice: parsed.showProgressNotice ?? DEFAULT_CONFIG.showProgressNotice,
            measurementStyle: (["tasks", "time", "both"] as const).includes(parsed.measurementStyle as any)
                ? (parsed.measurementStyle as UserConfig["measurementStyle"])
                : DEFAULT_CONFIG.measurementStyle,
            visualDensity: (["default", "compact"] as const).includes(parsed.visualDensity as any)
                ? (parsed.visualDensity as UserConfig["visualDensity"])
                : DEFAULT_CONFIG.visualDensity,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export function saveUserConfig(config: UserConfig): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearUserConfig(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
}

export function getActiveApiKey(config: UserConfig): string {
    return config.apiKeys[config.provider]?.trim() || "";
}

export function getActiveModel(config: UserConfig): string {
    return config.modelByProvider[config.provider]?.trim() || DEFAULT_PROVIDER_MODELS[config.provider];
}
