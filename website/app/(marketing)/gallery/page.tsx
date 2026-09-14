import GalleryFilters from "@/components/gallery/GalleryFilters";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import GallerySchema from "@/components/seo/GallerySchema";
import { listGallery } from "@/lib/server/gallery";

export default async function GalleryPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; mode?: string; contentType?: string }>;
}) {
    const params = await searchParams;
    const items = await listGallery({
        query: params.q,
        mode: params.mode,
        contentType: params.contentType,
    });

    return (
        <div className="page-shell-wide pb-24 pt-20 md:pt-24">
            <GallerySchema items={items} />

            <header className="app-header-block">
                <div>
                    <p className="eyebrow">Gallery</p>
                    <h1 className="mt-3 text-4xl font-display leading-none text-text-primary md:text-5xl">Gallery</h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
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
