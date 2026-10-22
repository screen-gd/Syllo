import { createFileRoute } from "@tanstack/react-router";
import ReaderPage from "@/views/studio/reader";
import { z } from "zod";

export const Route = createFileRoute("/_studio/read/$id")({ validateSearch: z.object({ cfi: z.string().max(2000).optional() }), head: () => ({ meta: [{ title: "Read | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: ReaderRoute });
function ReaderRoute() { const { id } = Route.useParams(); const { cfi } = Route.useSearch(); return <ReaderPage key={`${id}:${cfi ?? ""}`} id={id} targetCfi={cfi} />; }
