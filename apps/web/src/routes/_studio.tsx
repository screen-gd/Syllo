import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import LearningLayout from "@/components/layout/LearningLayout";
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
        <LearningLayout><Outlet /></LearningLayout>
    );
}
