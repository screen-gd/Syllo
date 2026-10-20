import type { PublicRoadmapCard } from "@/types";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadmap.znsnexus.com";

export default function GallerySchema({ items }: { items: PublicRoadmapCard[] }) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Public roadmap gallery",
        url: `${appUrl}/gallery`,
        mainEntity: items.slice(0, 12).map((item) => ({
            "@type": "CreativeWork",
            name: item.title,
            description: item.summary,
            url: `${appUrl}/share/${item.id}`,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
