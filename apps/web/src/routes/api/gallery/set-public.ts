import { createFileRoute } from "@tanstack/react-router";
import { setWorkspacePublic } from "@/lib/server/gallery";
import type { Roadmap } from "@/types";

export const Route = createFileRoute("/api/gallery/set-public")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    if (typeof body.workspaceId !== "string" || body.workspaceId.trim().length === 0) {
                        return Response.json({ success: false, error: "workspaceId is required" }, { status: 400 });
                    }

                    const roadmap =
                        body.roadmap && typeof body.roadmap === "object" ? (body.roadmap as Roadmap) : undefined;
                    const result = await setWorkspacePublic(body.workspaceId, Boolean(body.isPublic), roadmap);
                    return Response.json(result);
                } catch (error) {
                    console.error("Gallery visibility error:", error);
                    return Response.json({ success: false, error: "Failed to update visibility" }, { status: 500 });
                }
            },
        },
    },
});
