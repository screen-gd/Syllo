import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME } from "@/lib/constants";
import { PrivacyView } from "@/views/marketing/privacy";

export const Route = createFileRoute("/_marketing/privacy")({
    head: () => ({
        meta: [
            { title: `Privacy Policy | ${APP_NAME}` },
            {
                name: "description",
                content: "Read how ZNS RoadMap Studio handles local storage and your user data.",
            },
        ],
        links: [{ rel: "canonical", href: `${getAppUrl()}/privacy` }],
    }),
    component: PrivacyView,
});
