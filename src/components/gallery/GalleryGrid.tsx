import type { PublicRoadmapCard } from "@/types";
import GalleryCard from "@/components/gallery/GalleryCard";
import { Card, CardContent } from "@/components/ui/card";

export default function GalleryGrid({ items }: { items: PublicRoadmapCard[] }) {
    if (items.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="px-8 py-16 text-center">
                    <p className="text-sm text-text-secondary">No items match this view.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
                <GalleryCard key={item.id} item={item} />
            ))}
        </div>
    );
}
