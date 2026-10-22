import { createFileRoute } from "@tanstack/react-router";
import ReviewsPage from "@/views/studio/reviews";

export const Route = createFileRoute("/_studio/reviews")({ head: () => ({ meta: [{ title: "Reviews | Syllo" }, { name: "robots", content: "noindex, nofollow" }] }), component: ReviewsPage });
