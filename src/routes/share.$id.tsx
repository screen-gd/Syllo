import { createFileRoute } from "@tanstack/react-router";
import { getPublicWorkspaceFn } from "@/lib/server/fns";
import { APP_NAME } from "@/lib/constants";
import { ShareView } from "@/views/share";

export const Route = createFileRoute("/share/$id")({
    loader: ({ params }) => getPublicWorkspaceFn({ data: { id: params.id } }),
    head: () => ({
        meta: [
            { title: `Shared Workspace | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: ShareRoute,
});

function ShareRoute() {
    const roadmap = Route.useLoaderData();

    return <ShareView roadmap={roadmap} />;
}
