import type { Roadmap } from "@/types";
import { getRoadmapCompletionRate } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getTone(rate: number) {
    if (rate >= 0.85) return "bg-[rgba(22,20,17,0.9)]";
    if (rate >= 0.6) return "bg-[rgba(22,20,17,0.72)]";
    if (rate >= 0.35) return "bg-[rgba(22,20,17,0.48)]";
    return "bg-[rgba(22,20,17,0.22)]";
}

export default function SkillHeatmap({ roadmaps }: { roadmaps: Roadmap[] }) {
    if (roadmaps.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <p className="eyebrow">Heatmap</p>
                    <CardTitle className="mt-3 font-display text-2xl text-text-primary">Workspace readiness map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="studio-empty p-5 text-left text-sm leading-7 text-text-secondary">
                        No synced workspaces are available yet. Create an intern roadmap or sign in to import local progress into the dashboard.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <p className="eyebrow">Heatmap</p>
                <CardTitle className="mt-3 font-display text-2xl text-text-primary">Workspace readiness map</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                    {roadmaps.map((roadmap) => {
                        const rate = getRoadmapCompletionRate(roadmap);
                        return (
                            <div key={roadmap.id} className="studio-micro-grid p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{roadmap.title}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
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
                                <p className="mt-3 text-xs text-text-secondary">{Math.round(rate * 100)}% complete</p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
