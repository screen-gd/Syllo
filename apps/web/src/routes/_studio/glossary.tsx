import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import GlossaryPage from "@/views/studio/glossary";

const searchSchema = z.object({ roadmap: z.string().optional() });
export const Route = createFileRoute("/_studio/glossary")({ validateSearch: searchSchema, head: () => ({ meta: [{ title: "Glossary | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: GlossaryRoute });
function GlossaryRoute() { const { roadmap } = Route.useSearch(); return <GlossaryPage key={roadmap ?? ""} roadmapId={roadmap} />; }
