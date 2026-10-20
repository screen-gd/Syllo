import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Builds the application router. TanStack Start imports this from both the
 * client and the server entry points, so it must stay free of side effects.
 */
export function getRouter() {
    return createRouter({
        routeTree,
        scrollRestoration: true,
        defaultPreload: "intent",
    });
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
