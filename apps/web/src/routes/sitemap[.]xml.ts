import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/lib/app-url";

const appUrl = getAppUrl();

export const Route = createFileRoute("/sitemap.xml")({
    server: {
        handlers: {
            GET: () => {
                const now = new Date().toISOString();
                const entries: Array<[string, string, number]> = [
                    [appUrl, "weekly", 1],
                    [`${appUrl}/pricing`, "monthly", 0.8],
                    [`${appUrl}/gallery`, "weekly", 0.7],
                    [`${appUrl}/privacy`, "yearly", 0.4],
                    [`${appUrl}/terms`, "yearly", 0.4],
                    [`${appUrl}/contact`, "monthly", 0.5],
                ];

                const body = [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                    ...entries.map(
                        ([url, changeFrequency, priority]) =>
                            `  <url><loc>${url}</loc><lastmod>${now}</lastmod><changefreq>${changeFrequency}</changefreq><priority>${priority}</priority></url>`,
                    ),
                    "</urlset>",
                    "",
                ].join("\n");

                return new Response(body, {
                    headers: {
                        "content-type": "application/xml; charset=utf-8",
                        "cache-control": "public, max-age=3600",
                    },
                });
            },
        },
    },
});
