import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME } from "@/lib/constants";
import PricingPage from "@/views/marketing/pricing";

export const Route = createFileRoute("/_marketing/pricing")({
    head: () => ({
        meta: [
            { title: `Pricing | ${APP_NAME}` },
            {
                name: "description",
                content: "Compare plans for ZNS RoadMap Studio and choose the workspace depth that fits your study or teaching workflow.",
            },
        ],
        links: [{ rel: "canonical", href: `${getAppUrl()}/pricing` }],
    }),
    component: PricingPage,
});
