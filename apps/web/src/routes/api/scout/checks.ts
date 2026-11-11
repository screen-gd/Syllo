import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_PROVIDER_MODELS, isAiProvider } from "@/lib/ai-config";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson } from "@/lib/scout/http";
import { defaultScoutConfig, ScoutError, type ScoutLlmConfig } from "@/lib/scout/llm";
import { getVideoChecks } from "@/lib/scout/video-checks";
import type { VideoChapterInput } from "@/lib/scout/types";
import { getYouTubeId } from "@/lib/video-utils";

function readChapters(value: unknown): VideoChapterInput[] {
    if (!Array.isArray(value)) return [];
    return value
        .flatMap((item): VideoChapterInput[] => {
            if (!item || typeof item !== "object") return [];
            const seconds = "seconds" in item ? Number(item.seconds) : Number.NaN;
            const label = "label" in item && typeof item.label === "string" ? item.label.slice(0, 160) : "";
            return Number.isFinite(seconds) && seconds >= 0 ? [{ seconds, label }] : [];
        })
        .slice(0, 60);
}

export const Route = createFileRoute("/api/scout/checks")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await readJsonBody<{
                        url?: unknown;
                        title?: unknown;
                        chapters?: unknown;
                        durationSeconds?: unknown;
                        provider?: unknown;
                        model?: unknown;
                        apiKey?: unknown;
                    }>(request);
                    const videoId = typeof body?.url === "string" ? getYouTubeId(body.url) : null;
                    if (!videoId) return scoutBadRequest("Recall questions need a YouTube video.");

                    // The browser key is used for this request only and never stored.
                    let config: Partial<ScoutLlmConfig> | null = null;
                    if (typeof body?.apiKey === "string" && body.apiKey.trim()) {
                        const provider = isAiProvider(body.provider) ? body.provider : defaultScoutConfig().provider;
                        config = {
                            provider,
                            model:
                                typeof body.model === "string" && body.model.trim()
                                    ? body.model.trim()
                                    : DEFAULT_PROVIDER_MODELS[provider],
                            apiKey: body.apiKey.trim(),
                        };
                    }

                    const duration = Number(body?.durationSeconds);
                    const result = await getVideoChecks({
                        videoId,
                        title: typeof body?.title === "string" ? body.title.slice(0, 300) : "",
                        chapters: readChapters(body?.chapters),
                        durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
                        config,
                    });
                    return scoutJson({ success: true, ...result });
                } catch (error) {
                    if (error instanceof ScoutError) {
                        return scoutJson({ success: false, error: error.message, code: error.code }, error.code === "config" ? 400 : 503);
                    }
                    return scoutFailure(error, "Could not write recall questions for this video");
                }
            },
        },
    },
});
