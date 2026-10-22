import type { Roadmap } from "@/types";
import { getRoadmapCompletionRate } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getTone(rate: number) {
    if (rate >= 0.85) return "bg-accent";
    if (rate >= 0.6) return "bg-accent/70";
    if (rate >= 0.35) return "bg-accent/45";
    return "bg-accent/20";
}

export default function SkillHeatmap({ roadmaps }: { roadmaps: Roadmap[] }) {
    if (roadmaps.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base text-text">Workspace readiness map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="studio-empty p-5 text-left text-sm leading-7 text-text-muted">
                        No synced workspaces are available yet. Create an intern roadmap or sign in to import local progress into the dashboard.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-base text-text">Workspace readiness map</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                    {roadmaps.map((roadmap) => {
                        const rate = getRoadmapCompletionRate(roadmap);
                        return (
                            <div key={roadmap.id} className="studio-micro-grid p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-text">{roadmap.title}</p>
                                        <p className="mt-1 text-xs text-text-muted">
                                            {roadmap.mode} / {roadmap.contentType ?? "roadmap"}
                                        </p>
                                    </div>
                                    <span className={`h-3 w-3 rounded-full ${getTone(rate)}`} />
                                </div>

                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/70">
                                    <div
                                        className={`h-full rounded-full ${getTone(rate)}`}
                                        style={{ width: `${Math.max(6, rate * 100)}%` }}
                                    />
                                </div>
                                <p className="mt-3 text-xs text-text-muted">{Math.round(rate * 100)}% complete</p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
