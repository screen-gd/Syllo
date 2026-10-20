import { createMiddleware } from "@tanstack/react-start";
import { GATE_COOKIE, GATE_COOKIE_VALUE } from "@/lib/access-gate";

/**
 * Request middleware that reproduces the old `proxy.ts` password gate.
 *
 * Behaviour is intentionally identical to the Next.js version: everything is
 * locked until the gate cookie is present, including `/share/*` and `/embed/*`.
 * Changing that is a product decision, not part of the framework migration.
 */
const ALWAYS_ALLOWED = new Set(["/gate", "/api/gate"]);

/** Vite serves the client bundle from these prefixes in development. */
const ASSET_PREFIXES = ["/@vite/", "/@fs/", "/@id/", "/node_modules/", "/src/", "/assets/"];

const ASSET_EXTENSION = /\.(?:js|mjs|css|map|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|txt|xml|webmanifest)$/i;

function readCookie(header: string | null, name: string): string | undefined {
    if (!header) return undefined;

    for (const entry of header.split(";")) {
        const separator = entry.indexOf("=");
        if (separator === -1) continue;

        if (entry.slice(0, separator).trim() === name) {
            return decodeURIComponent(entry.slice(separator + 1).trim());
        }
    }

    return undefined;
}

export const gateMiddleware = createMiddleware().server(async ({ request, pathname, next }) => {
    if (ALWAYS_ALLOWED.has(pathname)) {
        return next();
    }

    if (
        ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
        ASSET_EXTENSION.test(pathname)
    ) {
        return next();
    }

    if (readCookie(request.headers.get("cookie"), GATE_COOKIE) === GATE_COOKIE_VALUE) {
        return next();
    }

    const url = new URL(request.url);
    const gateUrl = new URL("/gate", url);
    const destination = pathname + url.search;

    if (destination !== "/") {
        gateUrl.searchParams.set("next", destination);
    }

    return Response.redirect(gateUrl.toString(), 302);
});
