import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadmap.znsnexus.com";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        { url: appUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${appUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
        { url: `${appUrl}/gallery`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
        { url: `${appUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
        { url: `${appUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
        { url: `${appUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ];
}
