import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadmap.znsnexus.com";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/pricing", "/gallery", "/privacy", "/terms", "/contact"],
                disallow: ["/auth", "/notes", "/settings", "/workspace", "/workspaces", "/share", "/embed", "/api"],
            },
        ],
        sitemap: `${appUrl}/sitemap.xml`,
        host: appUrl,
    };
}
