import { createFileRoute } from "@tanstack/react-router";
import { recentPacks } from "@/lib/scout/pack";
import { scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";

export const Route = createFileRoute("/api/scout/recent")({
    server: {
        handlers: {
            GET: async () => {
                scoutReady();

                try {
                    return scoutJson({ success: true, packs: recentPacks(8) });
                } catch (error) {
                    return scoutFailure(error, "Scout could not list recent packs");
                }
            },
        },
    },
});
