import type { Roadmap } from "@/types";
import { getRoadmapCompletionRate } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AtRiskAlerts({ roadmaps }: { roadmaps: Roadmap[] }) {
    const atRisk = roadmaps.filter((roadmap) => getRoadmapCompletionRate(roadmap) < 0.35);

    return (
        <Card className="h-full">
            <CardHeader>
                <p className="eyebrow">At-risk modules</p>
                <CardTitle className="mt-3 font-display text-2xl text-text-primary">Escalation watchlist</CardTitle>
            </CardHeader>
            <CardContent>
                {atRisk.length === 0 ? (
                    <div className="border-y border-border py-5 text-sm text-text-secondary">
                        No roadmaps are currently below the intervention threshold.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {atRisk.map((roadmap) => (
                            <div key={roadmap.id} className="border-y border-border py-4">
                                <p className="font-semibold text-text-primary">{roadmap.title}</p>
                                <p className="mt-1 text-sm text-text-secondary">
                                    Completion is {Math.round(getRoadmapCompletionRate(roadmap) * 100)}%. Review tasks, unblock the next module, and log a coaching follow-up.
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
