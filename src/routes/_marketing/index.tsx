import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import MarketingPage from "@/views/marketing/home";

export const Route = createFileRoute("/_marketing/")({
    beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
    head: () => ({
        links: [{ rel: "canonical", href: getAppUrl() }],
    }),
    component: MarketingPage,
});
