import { createFileRoute } from "@tanstack/react-router";
import { exportUserData } from "@/lib/server/settings";

export const Route = createFileRoute("/api/settings/export")({
    server: {
        handlers: {
            GET: async () => {
                try {
                    const payload = await exportUserData();
                    return Response.json({ success: true, data: payload });
                } catch (error) {
                    console.error("Settings export error:", error);
                    return Response.json({ success: false, error: "Failed to export settings" }, { status: 500 });
                }
            },
        },
    },
});
