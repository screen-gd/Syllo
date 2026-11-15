"use client";

import type { Roadmap } from "@/types";
import { useProgress } from "@/hooks/useProgress";
import {
    DataList,
    DataListItem,
    DataListLabel,
    DataListValue,
} from "@/components/glaze/ui/data-list";
import { Progress } from "@/components/glaze/ui/progress";

interface Props {
    roadmap: Roadmap;
}

export default function ProgressSection({ roadmap }: Props) {
    const progress = useProgress(roadmap);

    const getMessage = (percent: number) => {
        if (percent === 0) return "Ready to begin? Start your first task.";
        if (percent < 25) return "Great start! You are on your way.";
        if (percent < 50) return "Gaining momentum. Keep up the good work!";
        if (percent < 75) return "Past the halfway mark! You're doing excellent.";
        if (percent < 100) return "Almost there! Just a few final steps.";
        return "Outstanding! You have completed everything!";
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="type-heading">Tracking</h2>
                <p className="mt-1 type-body-sm text-text-2">
                    {getMessage(progress.overall)}
                </p>
            </div>

            <section className="shell">
                <div className="panel flex flex-col gap-4 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="type-heading-sm">Total completion</span>
                        <span className="type-heading">{progress.overall}%</span>
                    </div>
                    <Progress
                        value={progress.overall}
                        aria-label="Total completion"
                    />
                    <DataList>
                        <DataListItem>
                            <DataListLabel>Completed</DataListLabel>
                            <DataListValue>
                                {progress.completedTasks}
                            </DataListValue>
                        </DataListItem>
                        <DataListItem>
                            <DataListLabel>Remaining</DataListLabel>
                            <DataListValue>
                                {progress.totalTasks - progress.completedTasks}
                            </DataListValue>
                        </DataListItem>
                    </DataList>
                </div>
            </section>

            {progress.phaseProgress.length > 0 ? (
                <section className="shell">
                    <div className="panel p-3">
                        <h3 className="type-heading-sm">Phase breakdown</h3>
                        <ul className="mt-3 flex flex-col gap-4">
                            {progress.phaseProgress.map((pm: { id: string; title: string; percent: number }) => (
                                <li key={pm.id}>
                                    <div className="mb-1 flex items-baseline justify-between gap-3">
                                        <span className="type-body-sm text-text-1">
                                            {pm.title}
                                        </span>
                                        <span className="type-caption text-text-2">
                                            {pm.percent}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={pm.percent}
                                        aria-label={`${pm.title} progress`}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
