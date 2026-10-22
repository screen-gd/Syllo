import { createServerFn } from "@tanstack/react-start";
import { listGallery } from "@/lib/server/gallery";
import { getPublicWorkspace } from "@/lib/server/workspaces";

/**
 * Route loaders run in the browser on client-side navigation, so anything that
 * touches the in-memory store has to cross the server-function boundary.
 */
export const listGalleryFn = createServerFn({ method: "GET" })
    .validator((data: { query?: string; mode?: string; contentType?: string }) => data)
    .handler(({ data }) =>
        listGallery({
            query: data.query,
            mode: data.mode,
            contentType: data.contentType,
        }),
    );

export const getPublicWorkspaceFn = createServerFn({ method: "GET" })
    .validator((data: { id: string }) => data)
    .handler(({ data }) => getPublicWorkspace(data.id));
