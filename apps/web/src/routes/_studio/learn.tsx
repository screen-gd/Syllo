import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import LearnPage from "@/views/studio/learn";

const searchSchema = z.object({ roadmap: z.string().optional(), task: z.string().optional(), seconds: z.number().nonnegative().optional() });
export const Route = createFileRoute("/_studio/learn")({ validateSearch: searchSchema, head: () => ({ meta: [{ title: "Learn | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: LearnRoute });
function LearnRoute() { const search = Route.useSearch(); return <LearnPage key={`${search.roadmap}:${search.task}:${search.seconds}`} roadmapId={search.roadmap} taskId={search.task} targetSeconds={search.seconds} />; }
