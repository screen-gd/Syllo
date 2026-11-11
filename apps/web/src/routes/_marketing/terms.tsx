import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME } from "@/lib/constants";
import { TermsView } from "@/views/marketing/terms";

export const Route = createFileRoute("/_marketing/terms")({
    head: () => ({
        meta: [
            { title: `Terms of Use | ${APP_NAME}` },
            {
                name: "description",
                content: "Terms for using Syllo.",
            },
        ],
        links: [{ rel: "canonical", href: `${getAppUrl()}/terms` }],
    }),
    component: TermsView,
});
