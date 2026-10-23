import { createFileRoute } from "@tanstack/react-router";
import WorkspacesPage from "@/views/studio/workspaces";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_studio/workspaces")({
    head: () => ({
        meta: [
            { title: `Your Workspaces | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: WorkspacesPage,
});
