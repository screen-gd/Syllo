import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing",
    description: "Compare Free, Pro, and Agency plans for ZNS RoadMap Studio.",
    alternates: {
        canonical: "/pricing",
    },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
