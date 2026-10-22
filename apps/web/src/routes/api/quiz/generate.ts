import { createFileRoute } from "@tanstack/react-router";
import { generateQuiz } from "@/lib/server/quiz";
import { isAiProvider } from "@/lib/ai-config";

export const Route = createFileRoute("/api/quiz/generate")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    if (!body?.roadmap || typeof body.sectionId !== "string") {
                        return Response.json(
                            { success: false, error: "roadmap and sectionId are required" },
                            { status: 400 },
                        );
                    }

                    const result = await generateQuiz({
                        roadmap: body.roadmap,
                        sectionId: body.sectionId,
                        userApiKey: typeof body.userApiKey === "string" ? body.userApiKey : undefined,
                        userModel: typeof body.userModel === "string" ? body.userModel : undefined,
                        userProvider: isAiProvider(body.userProvider) ? body.userProvider : undefined,
                    });

                    return Response.json(result, { status: result.success ? 200 : 402 });
                } catch (error) {
                    console.error("Quiz generation error:", error);
                    return Response.json({ success: false, error: "Failed to generate quiz" }, { status: 500 });
                }
            },
        },
    },
});
