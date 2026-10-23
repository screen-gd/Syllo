import { createFileRoute } from "@tanstack/react-router";
import CreatePage from "@/views/studio/create";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_studio/create")({
    head: () => ({
        meta: [
            { title: `Create Workspace | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: CreatePage,
});
