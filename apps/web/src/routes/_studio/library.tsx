import { createFileRoute } from "@tanstack/react-router";
import LibraryPage from "@/views/studio/library";

export const Route = createFileRoute("/_studio/library")({ head: () => ({ meta: [{ title: "Library | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: LibraryPage });
