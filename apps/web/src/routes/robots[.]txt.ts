import { createFileRoute } from "@tanstack/react-router";

/** Syllo is a personal app, so nothing on it should be indexed. */
export const Route = createFileRoute("/robots.txt")({
    server: {
        handlers: {
            GET: () =>
                new Response("User-agent: *\nDisallow: /\n", {
                    headers: {
                        "content-type": "text/plain; charset=utf-8",
                        "cache-control": "public, max-age=3600",
                    },
                }),
        },
    },
});
