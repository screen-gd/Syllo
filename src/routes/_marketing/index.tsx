import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import MarketingPage from "@/views/marketing/home";

export const Route = createFileRoute("/_marketing/")({
    head: () => ({
        links: [{ rel: "canonical", href: getAppUrl() }],
    }),
    component: MarketingPage,
});
