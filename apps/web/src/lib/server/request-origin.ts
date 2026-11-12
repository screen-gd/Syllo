/**
 * True when a browser sent the request from another site or port. Local mode
 * has no sign-in, so this keeps other pages from calling the local APIs and
 * spending the server's AI quota. Clients without these headers, such as
 * local scripts, are unaffected.
 */
export function isCrossOriginRequest(request: Request) {
    const site = request.headers.get("sec-fetch-site");
    if (site) return site !== "same-origin" && site !== "none";
    const origin = request.headers.get("origin");
    if (!origin) return false;
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    try {
        return new URL(origin).host !== host;
    } catch {
        return true;
    }
}
