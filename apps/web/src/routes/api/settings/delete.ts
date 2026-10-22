import { createFileRoute } from "@tanstack/react-router";
import { deleteAllUserData } from "@/lib/server/settings";

export const Route = createFileRoute("/api/settings/delete")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json().catch(() => ({}));
                    if (body.confirmation !== "DELETE") {
                        return Response.json(
                            { success: false, error: "Confirmation must equal DELETE" },
                            { status: 400 },
                        );
                    }

                    const result = await deleteAllUserData();
                    return Response.json(result);
                } catch (error) {
                    console.error("Settings delete error:", error);
                    return Response.json({ success: false, error: "Failed to delete user data" }, { status: 500 });
                }
            },
        },
    },
});
