import { createFileRoute } from "@tanstack/react-router";
import { getPackDetail } from "@/lib/scout/pack";
import { pathSegments, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";

export const Route = createFileRoute("/api/scout/packs/$id")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                scoutReady();

                try {
                    // /api/scout/packs/<id>
                    const id = pathSegments(request)[3];
                    const pack = id ? getPackDetail(id) : null;
                    if (!pack) {
                        return scoutJson({ success: false, error: "That pack does not exist" }, 404);
                    }
                    return scoutJson({ success: true, pack });
                } catch (error) {
                    return scoutFailure(error, "Scout could not load that pack");
                }
            },
        },
    },
});
