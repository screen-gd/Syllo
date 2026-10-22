import { createFileRoute } from "@tanstack/react-router";
import { buildDigest } from "@/lib/scout/digest";
import { scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";

export const Route = createFileRoute("/api/scout/digest")({
    server: {
        handlers: {
            GET: async () => {
                scoutReady();

                try {
                    return scoutJson({ success: true, digest: buildDigest() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not build your digest");
                }
            },
        },
    },
});
