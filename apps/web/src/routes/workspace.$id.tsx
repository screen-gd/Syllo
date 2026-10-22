import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { WorkspaceView } from "@/views/workspace";

export const Route = createFileRoute("/workspace/$id")({
    head: () => ({
        meta: [
            { title: `Workspace | ${APP_NAME}` },
            { name: "robots", content: "noindex, nofollow" },
        ],
    }),
    component: WorkspaceRoute,
});

function WorkspaceRoute() {
    const { id } = Route.useParams();

    return <WorkspaceView id={id} />;
}
