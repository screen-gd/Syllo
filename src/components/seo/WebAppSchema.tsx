import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadmap.znsnexus.com";

export default function WebAppSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: APP_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: APP_TAGLINE,
        url: appUrl,
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
