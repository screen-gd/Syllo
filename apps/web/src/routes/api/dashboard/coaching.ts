import { createFileRoute } from "@tanstack/react-router";
import { saveCoachingSession } from "@/lib/server/dashboard";

export const Route = createFileRoute("/api/dashboard/coaching")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    if (typeof body.roadmapId !== "string") {
                        return Response.json({ success: false, error: "roadmapId is required" }, { status: 400 });
                    }

                    const session = await saveCoachingSession({
                        roadmapId: body.roadmapId,
                        date: typeof body.date === "string" ? body.date : new Date().toISOString(),
                        durationMinutes: Number(body.durationMinutes ?? 0),
                        topics: Array.isArray(body.topics)
                            ? body.topics.filter((value: unknown): value is string => typeof value === "string")
                            : [],
                        nextSteps: typeof body.nextSteps === "string" ? body.nextSteps : "",
                    });

                    return Response.json({ success: true, session });
                } catch (error) {
                    console.error("Dashboard coaching error:", error);
                    return Response.json({ success: false, error: "Failed to save coaching session" }, { status: 500 });
                }
            },
        },
    },
});
