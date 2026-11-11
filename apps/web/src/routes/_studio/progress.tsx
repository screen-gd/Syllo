import { createFileRoute } from "@tanstack/react-router";
import ProgressPage from "@/views/studio/progress";

export const Route = createFileRoute("/_studio/progress")({ head: () => ({ meta: [{ title: "Progress | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: ProgressPage });
