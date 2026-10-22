import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/notes` was a stub in the Next app that redirected to the workspace list.
 */
export const Route = createFileRoute("/_studio/notes")({
    beforeLoad: () => {
        throw redirect({ to: "/workspaces" });
    },
});
