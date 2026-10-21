import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, TrendingUp, CheckCircle2, BookOpen, Trophy, Calendar, ArrowRight, Star } from "lucide-react";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import type { Roadmap, ModuleSection } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayCell {
    date: string; // YYYY-MM-DD
    count: number; // tasks completed on that day (approximated from updatedAt)
    level: 0 | 1 | 2 | 3 | 4; // intensity bucket
}

interface Milestone {
    id: string;
    roadmapTitle: string;
    roadmapId: string;
    label: string;
    completedAt: string; // ISO date string
    type: "roadmap-complete" | "module-complete" | "halfway";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToYMD(iso: string): string {
    return iso.slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
    const msA = new Date(a).getTime();
    const msB = new Date(b).getTime();
    return Math.round(Math.abs(msB - msA) / 86400000);
}

function buildConsistencyGrid(roadmaps: Roadmap[]): DayCell[] {
    // Build a 365-day window (52 weeks + padding)
    const todayStr = today();
    const startStr = addDays(todayStr, -363); // ~52 weeks back

    // Count completions per day using roadmap updatedAt as a proxy
    // In a real system you'd store per-task completion timestamps
    const counts: Record<string, number> = {};

    for (const roadmap of roadmaps) {
        const dateStr = isoToYMD(roadmap.updatedAt || roadmap.createdAt || todayStr);
        if (dateStr >= startStr && dateStr <= todayStr) {
            const stats = getRoadmapStats(roadmap);
            // Weight by how many tasks are completed
            counts[dateStr] = (counts[dateStr] || 0) + Math.max(1, Math.floor(stats.completedTasks / 2));
        }
    }

    const learning = getStorage().getLearningRecord();
    for (const [date, count] of Object.entries(learning.tasksByDate)) {
        if (date >= startStr && date <= todayStr) counts[date] = (counts[date] || 0) + count;
    }

    // Build the full 364-day array
    const cells: DayCell[] = [];
    const maxCount = Math.max(1, ...Object.values(counts));

    for (let i = 0; i < 364; i++) {
        const dateStr = addDays(startStr, i);
        const count = counts[dateStr] || 0;
        let level: DayCell["level"] = 0;
        if (count > 0) {
            const ratio = count / maxCount;
            if (ratio < 0.25) level = 1;
            else if (ratio < 0.5) level = 2;
            else if (ratio < 0.75) level = 3;
            else level = 4;
        }
        cells.push({ date: dateStr, count, level });
    }

    return cells;
}

function extractMilestones(roadmaps: Roadmap[]): Milestone[] {
    const milestones: Milestone[] = [];

    for (const roadmap of roadmaps) {
        const stats = getRoadmapStats(roadmap);
        const title = roadmap.title || "Untitled Workspace";
        const baseDate = roadmap.updatedAt || roadmap.createdAt || today();

        // Completed roadmap
        if (stats.progressState === "completed") {
            milestones.push({
                id: `${roadmap.id}-complete`,
                roadmapTitle: title,
                roadmapId: roadmap.id,
                label: `Completed "${title}"`,
                completedAt: baseDate,
                type: "roadmap-complete",
            });
        }

        // Halfway milestone
        if (stats.percent >= 50 && stats.progressState !== "not-started") {
            milestones.push({
                id: `${roadmap.id}-halfway`,
                roadmapTitle: title,
                roadmapId: roadmap.id,
                label: `Reached 50% in "${title}"`,
                completedAt: baseDate,
                type: "halfway",
            });
        }

        // Completed modules
        const moduleSections = roadmap.sections.filter((s) => s.type === "module") as ModuleSection[];
        for (const mod of moduleSections) {
            if (mod.data.completed) {
                milestones.push({
                    id: `${roadmap.id}-${mod.id}-module`,
                    roadmapTitle: title,
                    roadmapId: roadmap.id,
                    label: `Finished module: ${mod.title || "Untitled Module"}`,
                    completedAt: baseDate,
                    type: "module-complete",
                });
            }
        }
    }

    // Sort newest first
    return milestones
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 20);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConsistencyMatrix({ cells }: { cells: DayCell[] }) {
    const LEVEL_COLORS = [
"bg-[var(--color-surface-muted)]",  // 0 – empty
"bg-accent-soft/60",                  // 1 – light
"bg-accent/70",                  // 2 – medium
"bg-accent",                     // 3 – strong
"bg-accent",                     // 4 – max
    ];

    // Build columns (weeks)
    const weeks: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

    // Month labels
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, colIdx) => {
        const firstCell = week[0];
        if (firstCell) {
            const m = new Date(firstCell.date).getMonth();
            if (m !== lastMonth) {
                monthLabels.push({ label: MONTHS[m], col: colIdx });
                lastMonth = m;
            }
        }
    });

    const todayStr = today();

    return (
        <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-[700px]">
                {/* Month labels */}
                <div className="flex mb-1 pl-7">
                    {weeks.map((_, colIdx) => {
                        const label = monthLabels.find((m) => m.col === colIdx);
                        return (
                            <div key={colIdx} className="w-[14px] mx-[1px] text-xs text-text-muted shrink-0">
                                {label ? label.label : ""}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-0">
                    {/* Day-of-week labels */}
                    <div className="flex flex-col mr-1 shrink-0">
                        {DAYS.map((d, i) => (
                            <div key={i} className={`h-[14px] my-[1px] text-xs text-text-muted w-5 flex items-center ${i % 2 === 1 ? "" : "invisible"}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="flex flex-col">
                            {week.map((cell, dayIdx) => (
                                <div
                                    key={dayIdx}
                                    title={`${cell.date}: ${cell.count} activity`}
                                    className={`
                                        w-[14px] h-[14px] mx-[1px] my-[1px] rounded-sm shrink-0 transition-all cursor-default
                                        ${LEVEL_COLORS[cell.level]}
                                        ${cell.date === todayStr ? "ring-1 ring-border-strong ring-offset-1 ring-offset-[var(--color-page)]" : ""}
`}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 justify-end">
                    <span className="text-xs text-text-muted">Less</span>
                    {LEVEL_COLORS.map((cls, i) => (
                        <div key={i} className={`w-[12px] h-[12px] rounded-sm ${cls}`} />
                    ))}
                    <span className="text-xs text-text-muted">More</span>
                </div>
            </div>
        </div>
    );
}

function MilestoneTypeIcon({ type }: { type: Milestone["type"] }) {
    if (type === "roadmap-complete") return <Trophy size={16} className="text-warning" />;
    if (type === "halfway") return <Star size={16} className="text-accent" />;
    return <CheckCircle2 size={16} className="text-accent" />;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
    return (
        <div className="border border-border bg-surface rounded-2xl p-6 flex flex-col items-start gap-4 hover:bg-surface-muted hover:border-border-strong transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 text-text-muted group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-text-soft">{label}</p>
                <p className="text-3xl font-display text-text leading-tight mt-1 tracking-tight">{value}</p>
                {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [mounted, setMounted] = useState(false);
    const [streak, setStreak] = useState(0);
    const [tasksToday, setTasksToday] = useState(0);

    useEffect(() => {
        const storage = getStorage();
        setMounted(true);
        setRoadmaps(storage.getRoadmaps());

        const learning = storage.getLearningRecord();
        const todayKey = new Date().toLocaleDateString("en-CA");
        setStreak(learning.currentStreak);
        setTasksToday(learning.tasksByDate[todayKey] ?? 0);
    }, []);

    const cells = useMemo(() => (mounted ? buildConsistencyGrid(roadmaps) : []), [mounted, roadmaps]);
    const milestones = useMemo(() => (mounted ? extractMilestones(roadmaps) : []), [mounted, roadmaps]);

    const globalStats = useMemo(() => {
        let totalTasks = 0;
        let completedTasks = 0;
        let completedRoadmaps = 0;
        let inProgressRoadmaps = 0;

        for (const r of roadmaps) {
            const stats = getRoadmapStats(r);
            totalTasks += stats.totalTasks;
            completedTasks += stats.completedTasks;
            if (stats.progressState === "completed") completedRoadmaps++;
            if (stats.progressState === "in-progress") inProgressRoadmaps++;
        }

        const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return { totalTasks, completedTasks, completedRoadmaps, inProgressRoadmaps, overallPct };
    }, [roadmaps]);

    // Calculate active days from the cells array
    const activeDays = useMemo(() => cells.filter((c) => c.count > 0).length, [cells]);

    // Top roadmaps by progress
    const topRoadmaps = useMemo(() => {
        return [...roadmaps]
            .map((r) => ({ roadmap: r, stats: getRoadmapStats(r) }))
            .filter((x) => x.stats.totalTasks > 0)
            .sort((a, b) => b.stats.percent - a.stats.percent)
            .slice(0, 5);
    }, [roadmaps]);

    return (
        <div className="studio-page">
            {/* Header */}
            <header className="app-header-block">
                <h1>Analytics</h1>
                <p className="text-sm text-text-muted">Consistency and progress across your workspaces.</p>
            </header>

            {mounted ? (
                <div className="space-y-6">
                    {/* ── Stat Cards ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={<Flame size={20} className="text-[var(--color-warning)]" />}
                            label="Day Streak"
                            value={streak}
                            sub={tasksToday > 0 ? `${tasksToday} tasks today` : "No tasks yet today"}
                        />
                        <StatCard
                            icon={<CheckCircle2 size={20} className="text-accent" />}
                            label="Tasks Done"
                            value={globalStats.completedTasks}
                            sub={`of ${globalStats.totalTasks} total`}
                        />
                        <StatCard
                            icon={<Calendar size={20} />}
                            label="Active Days"
                            value={activeDays}
                            sub="in the last year"
                        />
                        <StatCard
                            icon={<Trophy size={20} className="text-warning" />}
                            label="Completed"
                            value={globalStats.completedRoadmaps}
                            sub={`${globalStats.inProgressRoadmaps} in progress`}
                        />
                    </div>

                    {/* ── Consistency Matrix ── */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-text-muted">
                                Consistency Matrix
                            </h2>
                            <span className="text-xs text-text-muted">{activeDays} active day{activeDays !== 1 ? "s" : ""} in the past year</span>
                        </div>
                        <div className="border border-border bg-[var(--color-surface)] rounded-xl p-6">
                            {cells.length === 0 ? (
                                <div className="py-12 text-center text-text-muted text-sm">No activity recorded yet. Start completing tasks to fill this in!</div>
                            ) : (
                                <ConsistencyMatrix cells={cells} />
                            )}
                        </div>
                    </section>

                    {/* ── Two Columns: Top Roadmaps + Milestones ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Top Roadmaps */}
                        <section>
                            <h2 className="text-sm font-semibold text-text-muted mb-4 border-b border-border pb-2">
                                Roadmap Progress
                            </h2>
                            <div className="space-y-3">
                                {topRoadmaps.length === 0 ? (
                                    <div className="border border-border bg-[var(--color-surface)] rounded-xl p-6 text-center">
                                        <p className="text-text-muted text-sm mb-3">No workspaces yet.</p>
                                        <Link to="/create" className="text-xs text-accent hover:text-accent underline underline-offset-2">
                                            Create your first roadmap →
                                        </Link>
                                    </div>
                                ) : (
                                    topRoadmaps.map(({ roadmap, stats }) => (
                                        <Link
                                            key={roadmap.id}
                                            to="/workspace/$id"
                                            params={{ id: roadmap.id }}
                                            className="flex items-center gap-4 p-4 border border-border bg-[var(--color-surface)] rounded-xl hover:border-text-soft transition-colors group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2 gap-2">
                                                    <h3 className="font-medium text-sm text-text truncate">{roadmap.title || "Untitled Workspace"}</h3>
                                                    <span className="text-xs text-text-muted shrink-0">{stats.percent}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            stats.progressState === "completed"
                                                                ? "bg-accent"
                                                                : "bg-accent"
                                                        }`}
                                                        style={{ width: `${stats.percent}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-text-muted mt-1.5">
                                                    {stats.completedTasks} / {stats.totalTasks} tasks · {stats.moduleCount} module{stats.moduleCount !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <ArrowRight size={14} className="text-text-muted group-hover:text-text transition-colors shrink-0" />
                                        </Link>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Milestones Timeline */}
                        <section>
                            <h2 className="text-sm font-semibold text-text-muted mb-4 border-b border-border pb-2">
                                Milestones
                            </h2>
                            {milestones.length === 0 ? (
                                <div className="border border-border bg-[var(--color-surface)] rounded-xl p-6 text-center">
                                    <BookOpen size={24} className="text-text-muted mx-auto mb-3" />
                                    <p className="text-text-muted text-sm">Complete modules and roadmaps to unlock milestones.</p>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-border ml-4 space-y-0">
                                    {milestones.map((ms, idx) => (
                                        <div key={ms.id} className="relative pl-6 pb-6 group">
                                            {/* Dot */}
                                            <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full border-2 border-border bg-[var(--color-page)] flex items-center justify-center group-hover:border-accent transition-colors">
                                                <MilestoneTypeIcon type={ms.type} />
                                            </div>

                                            <div className="border border-border bg-[var(--color-surface)] rounded-lg p-3 hover:border-text-soft transition-colors">
                                                <p className="text-sm text-text leading-snug">{ms.label}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-xs text-text-muted">
                                                        {new Date(ms.completedAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                    <span className="text-xs text-text-muted">·</span>
                                                    <Link
                                                        to="/workspace/$id"
                                                        params={{ id: ms.roadmapId }}
                                                        className="text-xs text-accent hover:text-accent truncate max-w-[160px]"
                                                    >
                                                        {ms.roadmapTitle}
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ── Overall Summary Bar ── */}
                    <section className="border border-border bg-[var(--color-surface)] rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-sm font-semibold text-text-muted">Overall Completion</h2>
                                <p className="text-3xl font-display text-text mt-1">{globalStats.overallPct}%</p>
                            </div>
                            <div className="flex gap-3 text-xs text-text-muted">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                                    {globalStats.completedTasks} completed
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[var(--color-surface-muted)] border border-border inline-block" />
                                    {globalStats.totalTasks - globalStats.completedTasks} remaining
                                </span>
                            </div>
                        </div>
                        <div className="h-3 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent rounded-full transition-all duration-700"
                                style={{ width: `${globalStats.overallPct}%` }}
                            />
                        </div>
                    </section>
                </div>
            ) : (
                /* Skeleton */
                <div className="mt-8 space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 bg-[var(--color-surface-muted)] rounded-xl" />
                        ))}
                    </div>
                    <div className="h-48 bg-[var(--color-surface-muted)] rounded-xl" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="h-64 bg-[var(--color-surface-muted)] rounded-xl" />
                        <div className="h-64 bg-[var(--color-surface-muted)] rounded-xl" />
                    </div>
                </div>
            )}
        </div>
    );
}
