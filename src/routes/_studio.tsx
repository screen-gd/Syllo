import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import StudioSidebar from "@/components/layout/StudioSidebar";
import { applyAccentTheme, applyVisualDensity } from "@/lib/accent-theme";
import { getUserConfig } from "@/lib/userConfig";

export const Route = createFileRoute("/_studio")({
    component: StudioLayout,
});

function StudioLayout() {
    // Accent and density live in local settings, so apply them once on the client.
    useEffect(() => {
        const config = getUserConfig();
        applyAccentTheme(config.accentColor);
        applyVisualDensity(config.visualDensity);
    }, []);

    return (
        <div className="min-h-screen bg-page text-text xl:grid xl:grid-cols-[224px_minmax(0,1fr)]">
            <StudioSidebar />
            <main id="main-content" className="min-w-0 px-4 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </div>
    );
}
