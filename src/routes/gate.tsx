import { createFileRoute } from "@tanstack/react-router";
import GatePage from "@/views/gate";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/gate")({
    head: () => ({
        meta: [
            { title: `Access | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: GatePage,
});
