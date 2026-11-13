import { createFileRoute, redirect } from "@tanstack/react-router";

/** Syllo has no landing page; the root opens Home. */
export const Route = createFileRoute("/_marketing/")({
    beforeLoad: () => {
        throw redirect({ to: "/dashboard" });
    },
});
