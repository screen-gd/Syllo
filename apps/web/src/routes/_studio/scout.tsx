import { createFileRoute } from "@tanstack/react-router";
import ScoutPage from "@/views/studio/scout";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_studio/scout")({
    head: () => ({
        meta: [
            { title: `Scout | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: ScoutPage,
});
