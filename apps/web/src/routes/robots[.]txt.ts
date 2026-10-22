import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";

const appUrl = getAppUrl();

export const Route = createFileRoute("/robots.txt")({
    server: {
        handlers: {
            GET: () =>
                new Response(
                    [
                        "User-agent: *",
                        "Allow: /",
                        "Allow: /pricing",
                        "Allow: /gallery",
                        "Allow: /privacy",
                        "Allow: /terms",
                        "Allow: /contact",
                        "Disallow: /auth",
                        "Disallow: /notes",
                        "Disallow: /settings",
                        "Disallow: /workspace",
                        "Disallow: /workspaces",
                        "Disallow: /share",
                        "Disallow: /embed",
                        "Disallow: /api",
                        "",
                        `Sitemap: ${appUrl}/sitemap.xml`,
                        `Host: ${appUrl}`,
                        "",
                    ].join("\n"),
                    {
                        headers: {
                            "content-type": "text/plain; charset=utf-8",
                            "cache-control": "public, max-age=3600",
                        },
                    },
                ),
        },
    },
});
