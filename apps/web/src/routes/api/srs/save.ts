import { createFileRoute } from "@tanstack/react-router";
import { saveSrsItems } from "@/lib/server/srs";

export const Route = createFileRoute("/api/srs/save")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    const items = Array.isArray(body?.items) ? body.items : [];
                    const saved = await saveSrsItems(items);
                    return Response.json({ success: true, items: saved });
                } catch (error) {
                    console.error("SRS save error:", error);
                    return Response.json(
                        { success: false, error: "Failed to save spaced repetition state" },
                        { status: 500 },
                    );
                }
            },
        },
    },
});
