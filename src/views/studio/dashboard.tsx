import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import type { Roadmap } from "@/types";

export default function DashboardPage() {
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [mounted, setMounted] = useState(false);
    const [currentStreak, setCurrentStreak] = useState(0);

    useEffect(() => {
        const storage = getStorage();
        let active = true;

        setMounted(true);
        setRoadmaps(storage.getRoadmaps());
        setCurrentStreak(storage.getLearningRecord().currentStreak);

        return () => {
            active = false;
        };
    }, []);

    const activeRoadmaps = useMemo(() => {
        return roadmaps
            .filter((r) => getRoadmapStats(r).progressState === "in-progress")
            .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
            .slice(0, 3);
    }, [roadmaps]);

    return (
        <div className="studio-page">
            <header className="app-header-block flex items-start justify-between gap-4">
                <div>
                    <p className="eyebrow text-emerald-500">Dashboard</p>
                    <h1 className="mt-3 text-4xl font-display leading-none text-zinc-100 tracking-tight md:text-5xl">
                        Today&apos;s Focus
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-zinc-400 max-w-xl">
                        Jump back into your active workspaces and keep your learning streak alive.
                    </p>
                </div>
                {mounted && (
                    <div className="hidden sm:flex flex-col items-center justify-center border border-white/10 bg-white/5 px-6 py-4 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.03)] hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:bg-white/10 hover:border-orange-500/30 hover:scale-[1.02] transition-all duration-300">
                        <Flame className="text-orange-500 mb-1 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]" size={28} fill="currentColor" />
                        <span className="text-2xl font-display text-orange-400 leading-none tracking-tight">{currentStreak}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/80 mt-1.5">Day Streak</span>
                    </div>
                )}
            </header>

            {mounted ? (
                <>
                    <section className="mt-8">
                        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                             <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Active Workspaces</h2>
                             {activeRoadmaps.length > 0 && <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{activeRoadmaps.length} Roadmap{activeRoadmaps.length > 1 ? 's' : ''}</span>}
                        </div>
                        {activeRoadmaps.length > 0 ? (
                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                {activeRoadmaps.map((roadmap) => {
                                    const stats = getRoadmapStats(roadmap);
                                    return (
                                        <div key={roadmap.id} className="group border border-white/10 bg-white/5 p-6 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] transition-all duration-300 ease-in-out hover:scale-[1.02] flex flex-col min-h-[180px]">
                                            <div className="flex justify-between items-start mb-4 gap-2">
                                                <h3 className="font-display leading-tight text-lg text-zinc-100 line-clamp-2 group-hover:text-emerald-300 transition-colors">{roadmap.title || "Untitled Workspace"}</h3>
                                            </div>
                                            
                                            <div className="space-y-3 mt-auto">
                                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                                    <span className="font-medium text-emerald-400">{stats.percent}% complete</span>
                                                    <span>{stats.completedTasks} / {stats.totalTasks}</span>
                                                </div>
                                                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
                                                        style={{ width: `${stats.percent}%` }}
                                                    />
                                                </div>
                                                <div className="pt-4 flex justify-between items-center w-full">
                                                    <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                        <Target size={12} className="text-emerald-500"/> Resume Module
                                                    </span>
                                                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 -mr-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10">
                                                        <Link to="/workspace/$id" params={{ id: roadmap.id }}>
                                                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="border border-white/10 border-dashed bg-white/5 p-12 text-center rounded-2xl flex flex-col items-center">
                                <span className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-zinc-600 mb-4 drop-shadow-sm">
                                   <Target size={20} />
                                </span>
                                <p className="text-zinc-400 text-sm mb-4">You have no active workspaces right now.</p>
                                <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold uppercase tracking-wider text-xs px-6 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <Link to="/create">Create new workspace</Link>
                                </Button>
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <div className="mt-8 space-y-6 animate-pulse">
                    <div className="h-6 w-32 bg-[var(--color-surface-muted)] rounded" />
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        <div className="h-40 bg-[var(--color-surface-muted)] rounded-xl" />
                        <div className="h-40 bg-[var(--color-surface-muted)] rounded-xl" />
                    </div>
                </div>
            )}
        </div>
    );
}
