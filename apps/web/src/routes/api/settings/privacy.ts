import { createFileRoute } from "@tanstack/react-router";
import { getPrivacySettings, updatePrivacySettings } from "@/lib/server/settings";

export const Route = createFileRoute("/api/settings/privacy")({
    server: {
        handlers: {
            GET: async () => {
                try {
                    const settings = await getPrivacySettings();
                    return Response.json({ success: true, settings });
                } catch (error) {
                    console.error("Privacy settings load error:", error);
                    return Response.json(
                        { success: false, error: "Failed to load privacy settings" },
                        { status: 500 },
                    );
                }
            },
            POST: async ({ request }) => {
                try {
                    const body = await request.json();
                    const settings = await updatePrivacySettings({
                        anonymousAnalytics: Boolean(body.anonymousAnalytics),
                        allowPublicGallery: Boolean(body.allowPublicGallery),
                    });
                    return Response.json({ success: true, settings });
                } catch (error) {
                    console.error("Privacy settings update error:", error);
                    return Response.json(
                        { success: false, error: "Failed to update privacy settings" },
                        { status: 500 },
                    );
                }
            },
        },
    },
});
