import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import NotesPage from "@/views/studio/notes";

const searchSchema = z.object({ roadmap: z.string().optional() });
export const Route = createFileRoute("/_studio/notes")({ validateSearch: searchSchema, head: () => ({ meta: [{ title: "Notes | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: NotesRoute });
function NotesRoute() { const { roadmap } = Route.useSearch(); return <NotesPage key={roadmap ?? ""} roadmapId={roadmap} />; }
