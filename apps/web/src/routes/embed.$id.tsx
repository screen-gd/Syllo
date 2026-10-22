import { createFileRoute } from "@tanstack/react-router";
import { getPublicWorkspaceFn } from "@/lib/server/fns";
import { APP_NAME } from "@/lib/constants";
import { EmbedView } from "@/views/embed";

export const Route = createFileRoute("/embed/$id")({
    loader: ({ params }) => getPublicWorkspaceFn({ data: { id: params.id } }),
    head: () => ({
        meta: [
            { title: `Embedded Workspace | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: EmbedRoute,
});

function EmbedRoute() {
    const roadmap = Route.useLoaderData();

    return <EmbedView roadmap={roadmap} />;
}
