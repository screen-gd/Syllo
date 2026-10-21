import { createFileRoute } from "@tanstack/react-router";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { addManualResource, listBooks, listLibrary, searchLibrary } from "@/lib/scout/library";
import type { ResourceKind } from "@/lib/scout/types";

const KINDS: Array<ResourceKind | "all"> = ["all", "video", "article", "doc", "book"];

export const Route = createFileRoute("/api/scout/resources")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                scoutReady();

                try {
                    const params = new URL(request.url).searchParams;
                    const query = params.get("q")?.trim() ?? "";
                    const rawKind = params.get("kind")?.trim() ?? "all";
                    const kind = (KINDS as string[]).includes(rawKind) ? (rawKind as ResourceKind | "all") : "all";
                    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 40) || 40));

                    const resources = query ? searchLibrary(query, limit) : listLibrary({ kind, limit });
                    return scoutJson({ success: true, resources, books: listBooks() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not read your library");
                }
            },
            POST: async ({ request }) => {
                scoutReady();

                try {
                    const body = await readJsonBody<{
                        url?: unknown;
                        title?: unknown;
                        note?: unknown;
                        skill?: unknown;
                        kind?: unknown;
                        outline?: unknown;
                    }>(request);

                    const url = typeof body?.url === "string" ? body.url.trim() : "";
                    const title = typeof body?.title === "string" ? body.title.trim() : "";
                    if (!url && !title) return scoutBadRequest("Add a URL or a title.");

                    const kind = body?.kind === "book" ? "book" : undefined;
                    const skills =
                        typeof body?.skill === "string" && body.skill.trim() ? [body.skill.trim()] : undefined;
                    const outline = Array.isArray(body?.outline)
                        ? body.outline.filter((chapter): chapter is string => typeof chapter === "string")
                        : undefined;

                    const resource = addManualResource({
                        url: url || null,
                        title: title || null,
                        kind,
                        note: typeof body?.note === "string" ? body.note : null,
                        skills,
                        outline,
                    });

                    return scoutJson({ success: true, resource }, 201);
                } catch (error) {
                    return scoutFailure(error, "Scout could not add that resource");
                }
            },
        },
    },
});
