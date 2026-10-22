import { createFileRoute } from "@tanstack/react-router";
import { listGalleryFn } from "@/lib/server/fns";
import { getAppUrl } from "@/lib/app-url";
import { GalleryView } from "@/views/marketing/gallery";

type GallerySearch = {
    q?: string;
    mode?: string;
    contentType?: string;
};

function parseSearch(search: Record<string, unknown>): GallerySearch {
    const read = (key: keyof GallerySearch) =>
        typeof search[key] === "string" ? (search[key] as string) : undefined;

    return {
        q: read("q"),
        mode: read("mode"),
        contentType: read("contentType"),
    };
}

export const Route = createFileRoute("/_marketing/gallery")({
    validateSearch: parseSearch,
    loaderDeps: ({ search }) => search,
    loader: ({ deps }) =>
        listGalleryFn({
            data: {
                query: deps.q,
                mode: deps.mode,
                contentType: deps.contentType,
            },
        }),
    head: () => ({
        links: [{ rel: "canonical", href: `${getAppUrl()}/gallery` }],
    }),
    component: GalleryRoute,
});

function GalleryRoute() {
    const items = Route.useLoaderData();

    return <GalleryView items={items} />;
}
