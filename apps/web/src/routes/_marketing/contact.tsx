import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";
import ContactPage from "@/views/marketing/contact";

export const Route = createFileRoute("/_marketing/contact")({
    head: () => ({
        links: [{ rel: "canonical", href: `${getAppUrl()}/contact` }],
    }),
    component: ContactPage,
});
