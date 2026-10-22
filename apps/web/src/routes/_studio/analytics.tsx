import { createFileRoute } from "@tanstack/react-router";
import AnalyticsPage from "@/views/studio/analytics";

export const Route = createFileRoute("/_studio/analytics")({
    head: () => ({
        meta: [{ name: "robots", content: "noindex, nofollow" }],
    }),
    component: AnalyticsPage,
});
