"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface VelocityPoint {
    date: string;
    completedTasks: number;
}

export default function VelocityChart({ points }: { points: VelocityPoint[] }) {
    if (points.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader className="flex flex-row items-end justify-between gap-4">
                    <div>
                        <CardTitle className="text-base text-text">14-day completion rhythm</CardTitle>
                    </div>
                    <p className="text-xs text-text-muted">Tasks completed</p>
                </CardHeader>
                <CardContent>
                    <div className="studio-empty p-5 text-left text-sm leading-7 text-text-muted">
                        No progress snapshots have been recorded yet. Completion bars will appear here once workspace activity is captured.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const maxValue = Math.max(...points.map((point) => point.completedTasks), 1);

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-end justify-between gap-4">
                <div>
                    <CardTitle className="text-base text-text">14-day completion rhythm</CardTitle>
                </div>
                <p className="text-xs text-text-muted">Tasks completed</p>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto pb-2">
                    <div className="mt-2 flex h-64 min-w-[560px] items-end gap-2">
                        {points.map((point) => {
                            const height = `${Math.max(10, (point.completedTasks / maxValue) * 100)}%`;
                            return (
                                <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-3">
                                    <div className="flex h-full w-full items-end">
                                        <div
                                            className="w-full rounded-t-[4px] bg-accent"
                                            style={{ height }}
                                            title={`${point.completedTasks} completed on ${point.date}`}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-semibold text-text">{point.completedTasks}</p>
                                        <p className="text-xs text-text-muted">
                                            {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
