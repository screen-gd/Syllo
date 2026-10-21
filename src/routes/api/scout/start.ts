import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_PROVIDER_MODELS, isAiProvider } from "@/lib/ai-config";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { defaultScoutConfig, type ScoutLlmConfig } from "@/lib/scout/llm";
import { startPack } from "@/lib/scout/pipeline";

export const Route = createFileRoute("/api/scout/start")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                scoutReady();

                try {
                    const body = await readJsonBody<{
                        goal?: unknown;
                        provider?: unknown;
                        model?: unknown;
                        apiKey?: unknown;
                    }>(request);

                    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
                    if (goal.length < 4) {
                        return scoutBadRequest("Tell Scout what you want to learn, in a few words.");
                    }
                    if (goal.length > 400) {
                        return scoutBadRequest("Keep the goal under 400 characters.");
                    }

                    // The browser sends its BYO key once. It stays in process
                    // memory for this pack and is never written to SQLite.
                    let llm: ScoutLlmConfig | null = null;
                    if (typeof body?.apiKey === "string" && body.apiKey.trim()) {
                        const provider = isAiProvider(body.provider) ? body.provider : defaultScoutConfig().provider;
                        llm = {
                            provider,
                            model:
                                typeof body.model === "string" && body.model.trim()
                                    ? body.model.trim()
                                    : DEFAULT_PROVIDER_MODELS[provider],
                            apiKey: body.apiKey.trim(),
                        };
                    }

                    const pack = startPack(goal, llm);
                    return scoutJson({ success: true, pack });
                } catch (error) {
                    return scoutFailure(error, "Scout could not start");
                }
            },
        },
    },
});
