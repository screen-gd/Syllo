import { createFileRoute } from "@tanstack/react-router";
import { forkGalleryRoadmap } from "@/lib/server/gallery";

export const Route = createFileRoute("/api/gallery/fork")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    if (typeof body.workspaceId !== "string" || body.workspaceId.trim().length === 0) {
                        return Response.json({ success: false, error: "workspaceId is required" }, { status: 400 });
                    }

                    const roadmap = await forkGalleryRoadmap(body.workspaceId);
                    return Response.json({ success: true, roadmap });
                } catch (error) {
                    console.error("Gallery fork error:", error);
                    return Response.json({ success: false, error: "Failed to fork workspace" }, { status: 500 });
                }
            },
        },
    },
});
