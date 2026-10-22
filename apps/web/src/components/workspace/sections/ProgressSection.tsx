"use client";

import type { Roadmap } from "@/types";
import { useProgress } from "@/hooks/useProgress";
import ProgressRing from "@/components/shared/ProgressRing";

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
        return "Outstanding! You have completed everything! 🎉";
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in relative">
            <div className="mb-10 text-center">
                <h2 className="font-display text-4xl font-semibold text-text mb-3 drop-shadow-md">
                    📊 Tracking
                </h2>
                <p className="text-text-muted text-base max-w-lg mx-auto">
                    {getMessage(progress.overall)}
                </p>
            </div>

            {/* Main Ring Area */}
            <div className="surface rounded-3xl p-8 sm:p-12 text-center mb-8 border border-border shadow-2xl relative overflow-hidden group">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 blur-[80px] rounded-full pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />

                <div className="flex flex-col items-center justify-center relative z-10">
                    <div className="relative">
                        <ProgressRing percent={progress.overall} size={220} strokeWidth={12} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center drop-shadow-lg">
                            <span className="text-5xl font-semibold bg-accent tabular-nums tracking-tighter">
                                {progress.overall}%
                            </span>
                            <span className="text-sm font-bold text-text-muted mt-2">
                                Total Completion
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-6 px-6 py-3 rounded-2xl bg-surface-muted/50 border border-border shadow-inner">
                        <div className="text-center">
                            <p className="text-sm text-text-muted font-medium mb-1">Completed</p>
                            <p className="text-2xl font-bold text-accent tabular-nums drop-shadow-sm">{progress.completedTasks}</p>
                        </div>
                        <div className="w-[2px] h-10 bg-surface-muted rounded" />
                        <div className="text-center">
                            <p className="text-sm text-text-muted font-medium mb-1">Remaining</p>
                            <p className="text-2xl font-bold text-text tabular-nums drop-shadow-sm">{progress.totalTasks - progress.completedTasks}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Phase Breakdown */}
            {progress.phaseProgress.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <h3 className="col-span-1 border-b border-border pb-2 mb-2 sm:col-span-2 font-display text-lg font-bold text-text-muted">Phase Breakdown</h3>
                    {progress.phaseProgress.map((pm: { id: string; title: string; percent: number }, i: number) => (
                        <div key={pm.id} className="surface rounded-xl p-5 border border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300 animate-slide-up bg-surface/60" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-bold text-text truncate pr-2">{pm.title}</span>
                                <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md bg-surface-muted ${pm.percent === 100 ? 'text-accent' : 'text-accent'}`}>
                                    {pm.percent}%
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden bg-surface-muted shadow-inner">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] bg-accent relative"
                                    style={{ width: `${pm.percent}%` }}
                                >
                                    {pm.percent === 100 && (
                                        <div className="absolute inset-0 bg-accent" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
