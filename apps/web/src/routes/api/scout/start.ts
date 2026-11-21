import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_PROVIDER_MODELS, isAiProvider } from "@/lib/ai-config";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { defaultScoutConfig, resolveScoutLlm, type ScoutLlmConfig } from "@/lib/scout/llm";
import { assertFreeAi } from "@/lib/ai-policy";
import { startPack } from "@/lib/scout/pipeline";
import { SOURCE_COPY } from "@/lib/scout/source-copy";
import { MAX_SOURCE_LINKS, parseSourceLinks } from "@/lib/scout/source-links";

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
                        sources?: unknown;
                    }>(request);

                    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
                    if (goal.length < 4) {
                        return scoutBadRequest("Tell Scout what you want to learn, in a few words.");
                    }
                    if (goal.length > 1200) {
                        return scoutBadRequest("Keep the goal and its context under 1200 characters.");
                    }

                    let links: string[] = [];
                    if (body?.sources !== undefined && body.sources !== null) {
                        if (!Array.isArray(body.sources) || !body.sources.every((line) => typeof line === "string")) {
                            return scoutBadRequest("Sources must be a list of YouTube links.");
                        }
                        links = body.sources.map((line) => line.trim()).filter(Boolean);
                    }
                    if (links.length > 0) {
                        const parsed = parseSourceLinks(links.join("\n"));
                        if (parsed.invalid.length > 0) {
                            return scoutBadRequest(SOURCE_COPY.invalidLink(parsed.invalid[0]));
                        }
                        if (parsed.links.length > MAX_SOURCE_LINKS) {
                            return scoutBadRequest(SOURCE_COPY.tooManyLinks);
                        }
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

                    const config = resolveScoutLlm(llm);
                    assertFreeAi(config.provider, config.model);
                    if (!config.apiKey) return scoutBadRequest("Add a free Gemini API key in Settings to use Scout. You can still create a roadmap from your own links without a key.");
                    const pack = startPack(goal, llm, links);
                    return scoutJson({ success: true, pack });
                } catch (error) {
                    return scoutFailure(error, "Scout could not start");
                }
            },
        },
    },
});
