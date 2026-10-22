import { createFileRoute } from "@tanstack/react-router";
import { readJsonBody, pathSegments, scoutBadRequest, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { approvePackPicks, getPackDetail, getPackRow } from "@/lib/scout/pack";
import { queueWorkspaceBuild } from "@/lib/scout/pipeline";

export const Route = createFileRoute("/api/scout/packs/$id/approve")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                scoutReady();

                try {
                    // /api/scout/packs/<id>/approve
                    const id = pathSegments(request)[3];
                    const pack = id ? getPackRow(id) : null;
                    if (!id || !pack) {
                        return scoutJson({ success: false, error: "That pack does not exist" }, 404);
                    }

                    const body = await readJsonBody<{ picks?: unknown }>(request);
                    const picks = Array.isArray(body?.picks)
                        ? body.picks.filter((pick): pick is string => typeof pick === "string")
                        : [];

                    const accepted = approvePackPicks(id, picks);
                    if (accepted.length === 0) {
                        return scoutBadRequest("Keep at least one resource before building the roadmap.");
                    }

                    queueWorkspaceBuild(id);
                    return scoutJson({ success: true, pack: getPackDetail(id) });
                } catch (error) {
                    return scoutFailure(error, "Scout could not save your picks");
                }
            },
        },
    },
});
