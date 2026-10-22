import { createFileRoute } from "@tanstack/react-router";
import { listGallery } from "@/lib/server/gallery";

export const Route = createFileRoute("/api/gallery/list")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                try {
                    const { searchParams } = new URL(request.url);
                    const items = await listGallery({
                        query: searchParams.get("q") ?? undefined,
                        mode: searchParams.get("mode") ?? undefined,
                        contentType: searchParams.get("contentType") ?? undefined,
                    });
                    return Response.json({ success: true, items });
                } catch (error) {
                    console.error("Gallery list error:", error);
                    return Response.json({ success: false, error: "Failed to load gallery" }, { status: 500 });
                }
            },
        },
    },
});
