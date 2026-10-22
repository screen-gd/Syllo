import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "@/views/studio/personal-settings";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_studio/settings")({
    validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
        tab: typeof search.tab === "string" ? search.tab : undefined,
    }),
    head: () => ({
        meta: [
            { title: `Settings | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: SettingsPage,
});
