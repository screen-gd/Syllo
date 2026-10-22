import { createFileRoute } from "@tanstack/react-router";
import { readJsonBody, scoutBadRequest, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { addSource, isSourceKind, listSources, removeSource, setSourceEnabled } from "@/lib/scout/sources";

export const Route = createFileRoute("/api/scout/sources")({
    server: {
        handlers: {
            GET: async () => {
                scoutReady();

                try {
                    return scoutJson({ success: true, sources: listSources() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not list your sources");
                }
            },
            POST: async ({ request }) => {
                scoutReady();

                try {
                    const body = await readJsonBody<{
                        kind?: unknown;
                        label?: unknown;
                        value?: unknown;
                        enabled?: unknown;
                        id?: unknown;
                    }>(request);

                    if (typeof body?.id === "string" && typeof body.enabled === "boolean") {
                        setSourceEnabled(body.id, body.enabled);
                        return scoutJson({ success: true, sources: listSources() });
                    }

                    if (!isSourceKind(body?.kind)) {
                        return scoutBadRequest("Pick a channel, a site, or a creator.");
                    }

                    const value = typeof body?.value === "string" ? body.value.trim() : "";
                    if (!value) return scoutBadRequest("Add a channel handle or a site URL.");

                    const label =
                        typeof body?.label === "string" && body.label.trim() ? body.label.trim() : value;

                    const source = addSource({ kind: body.kind, label, value });
                    return scoutJson({ success: true, source, sources: listSources() }, 201);
                } catch (error) {
                    return scoutFailure(error, "Scout could not add that source");
                }
            },
            DELETE: async ({ request }) => {
                scoutReady();

                try {
                    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
                    if (!id) return scoutBadRequest("Missing source id");
                    removeSource(id);
                    return scoutJson({ success: true, sources: listSources() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not remove that source");
                }
            },
        },
    },
});
