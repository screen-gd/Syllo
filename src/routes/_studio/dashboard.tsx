import { createFileRoute } from "@tanstack/react-router";
import DashboardPage from "@/views/studio/dashboard";

export const Route = createFileRoute("/_studio/dashboard")({
    head: () => ({
        meta: [{ name: "robots", content: "noindex, nofollow" }],
    }),
    component: DashboardPage,
});
