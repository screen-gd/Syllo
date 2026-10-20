import { createFileRoute } from "@tanstack/react-router";
import { handleRoadmapIntake } from "@/lib/server/roadmap-intake";

export const Route = createFileRoute("/api/parse-roadmap")({
    server: {
        handlers: {
            POST: ({ request }) => handleRoadmapIntake(request),
        },
    },
});
