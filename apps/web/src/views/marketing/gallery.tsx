import GalleryFilters from "@/components/gallery/GalleryFilters";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import GallerySchema from "@/components/seo/GallerySchema";
import type { PublicRoadmapCard } from "@/types";

export function GalleryView({ items }: { items: PublicRoadmapCard[] }) {
    return (
        <div className="page-shell-wide pb-24 pt-10 md:pt-12">
            <GallerySchema items={items} />

            <header className="app-header-block">
                <div>
                    <h1 className="mt-3 text-4xl font-display leading-none text-text md:text-5xl">Gallery</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted">
                        Browse public workspaces and saved starting points.
                    </p>
                </div>
            </header>

            <section className="section-space-compact">
                <div className="filter-bar">
                    <GalleryFilters />
                </div>
                <div className="mt-8">
                    <GalleryGrid items={items} />
                </div>
            </section>
        </div>
    );
}
