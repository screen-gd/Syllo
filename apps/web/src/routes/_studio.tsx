import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import LearningLayout from "@/components/layout/LearningLayout";
import { applyVisualDensity } from "@/lib/accent-theme";
import { applyAppearance, getAppearance } from "@/lib/appearance";
import { getUserConfig } from "@/lib/userConfig";

export const Route = createFileRoute("/_studio")({
    component: StudioLayout,
});

function StudioLayout() {
    // Theme and density live in local settings, so apply them once on the client.
    useEffect(() => {
        applyAppearance(getAppearance());
        applyVisualDensity(getUserConfig().visualDensity);
    }, []);

    return (
        <LearningLayout><Outlet /></LearningLayout>
    );
}
