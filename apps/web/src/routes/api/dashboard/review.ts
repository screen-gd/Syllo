import { createFileRoute } from "@tanstack/react-router";
import { generateNinetyDayReview } from "@/lib/server/dashboard";
import { isAiProvider } from "@/lib/ai-config";

export const Route = createFileRoute("/api/dashboard/review")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    if (typeof body.roadmapId !== "string") {
                        return Response.json({ success: false, error: "roadmapId is required" }, { status: 400 });
                    }

                    const result = await generateNinetyDayReview({
                        roadmapId: body.roadmapId,
                        userApiKey: typeof body.userApiKey === "string" ? body.userApiKey : undefined,
                        userModel: typeof body.userModel === "string" ? body.userModel : undefined,
                        userProvider: isAiProvider(body.userProvider) ? body.userProvider : undefined,
                    });

                    return Response.json(result, { status: result.success ? 200 : 402 });
                } catch (error) {
                    console.error("Dashboard review error:", error);
                    return Response.json(
                        { success: false, error: "Failed to generate 90-day review" },
                        { status: 500 },
                    );
                }
            },
        },
    },
});
