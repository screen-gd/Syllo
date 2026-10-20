import { Link } from "@tanstack/react-router";
import type { Roadmap } from "@/types";
import { getRoadmapCompletionRate, getRoadmapTaskTotals } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ModuleCompletionTable({ roadmaps }: { roadmaps: Roadmap[] }) {
    if (roadmaps.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <p className="eyebrow">Completion table</p>
                    <CardTitle className="mt-3 font-display text-2xl text-text-primary">Roadmap completion overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="studio-empty p-5 text-left text-sm leading-7 text-text-secondary">
                        No roadmap records are available for completion reporting yet.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <p className="eyebrow">Completion table</p>
                <CardTitle className="mt-3 font-display text-2xl text-text-primary">Roadmap completion overview</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="studio-table overflow-hidden">
                        <table className="w-full min-w-[760px] text-left">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                                    <th className="px-4 py-3">Workspace</th>
                                    <th className="px-4 py-3">Mode</th>
                                    <th className="px-4 py-3">Tasks</th>
                                    <th className="px-4 py-3">Completion</th>
                                    <th className="px-4 py-3">Open</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roadmaps.map((roadmap) => {
                                    const totals = getRoadmapTaskTotals(roadmap);
                                    const rate = Math.round(getRoadmapCompletionRate(roadmap) * 100);
                                    return (
                                        <tr key={roadmap.id} className="text-sm text-text-primary">
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-semibold text-text-primary">{roadmap.title}</p>
                                                    <p className="mt-1 text-xs text-text-secondary">{roadmap.summary ?? "No summary"}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-text-secondary">{roadmap.mode}</td>
                                            <td className="px-4 py-4 text-text-secondary">
                                                {totals.completedTasks}/{totals.totalTasks}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-border/70">
                                                        <div
                                                            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(22,20,17,0.92),rgba(22,20,17,0.4))]"
                                                            style={{ width: `${Math.max(6, rate)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-semibold text-text-primary">{rate}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Link to="/workspace/$id" params={{ id: roadmap.id }} className="button-secondary text-xs">
                                                    Open
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
