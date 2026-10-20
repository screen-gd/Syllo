import { APP_NAME } from "@/lib/constants";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadmap.znsnexus.com";

export default function HowToSchema() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to create a workspace in ${APP_NAME}`,
        step: [
            {
                "@type": "HowToStep",
                name: "Paste your source material",
                text: "Add your roadmap, guide, curriculum, or process document into the create flow.",
            },
            {
                "@type": "HowToStep",
                name: "Generate an interactive workspace",
                text: "Let GPT-5.4 structure the source into a course-style roadmap with actionable sections.",
            },
            {
                "@type": "HowToStep",
                name: "Track progress and return later",
                text: "Continue from your workspace, review modules, and enable account sync when you want cloud backup.",
            },
        ],
        totalTime: "PT5M",
        tool: [
            {
                "@type": "HowToTool",
                name: APP_NAME,
            },
        ],
        url: appUrl,
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
