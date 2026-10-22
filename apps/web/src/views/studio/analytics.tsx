import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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

// Intensity buckets for the matrix: one hue, stepped by opacity.
const LEVEL_COLORS = ["bg-surface-muted", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

/** A year of activity, one column per week, stretched to the panel's width. */
function ConsistencyMatrix({ cells }: { cells: DayCell[] }) {
    const weeks: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    const monthLabels = new Map<number, string>();
    let lastMonth = -1;
    weeks.forEach((week, column) => {
        const first = week[0];
        if (!first) return;
        const month = new Date(first.date).getMonth();
        if (month !== lastMonth) {
            // Skip a label squeezed against the previous one at the left edge.
            if (column > 1 || monthLabels.size === 0) monthLabels.set(column, MONTHS[month]);
            lastMonth = month;
        }
    });

    const todayStr = today();
    const columns = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` };

    return (
        <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[32px_minmax(0,1fr)] gap-x-2">
                <span />
                <div className="mb-1.5 grid gap-[3px]" style={columns}>
                    {weeks.map((_, column) => (
                        <span key={column} className="overflow-visible whitespace-nowrap text-xs text-text-soft">
                            {monthLabels.get(column) ?? ""}
                        </span>
                    ))}
                </div>

                <div className="grid grid-rows-7 gap-[3px]">
                    {DAYS.map((day, index) => (
                        <span key={index} className="flex items-center text-xs text-text-soft">
                            {day}
                        </span>
                    ))}
                </div>
                <div className="grid gap-[3px]" style={columns}>
                    {weeks.map((week, column) => (
                        <div key={column} className="grid grid-rows-7 gap-[3px]">
                            {week.map((cell) => (
                                <div
                                    key={cell.date}
                                    title={`${cell.date}: ${cell.count} completed`}
                                    className={`aspect-square rounded-[3px] ${LEVEL_COLORS[cell.level]} ${
                                        cell.date === todayStr ? "outline outline-1 outline-text-soft" : ""
                                    }`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-1.5 text-xs text-text-soft">
                <span className="mr-1">Less</span>
                {LEVEL_COLORS.map((cls) => (
                    <span key={cls} className={`h-3 w-3 rounded-[3px] ${cls}`} />
                ))}
                <span className="ml-1">More</span>
            </div>
        </div>
    );
}

const MILESTONE_LABELS: Record<Milestone["type"], string> = {
    "roadmap-complete": "Workspace done",
    "module-complete": "Module done",
    halfway: "Halfway",
};

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

    const kpis = [
        {
            label: "Overall completion",
            value: `${globalStats.overallPct}`,
            unit: "%",
            sub: `${globalStats.completedTasks} of ${globalStats.totalTasks} tasks`,
        },
        { label: "Streak", value: `${streak}`, unit: streak === 1 ? "day" : "days", sub: `${tasksToday} tasks today` },
        { label: "Active days", value: `${activeDays}`, unit: "", sub: "in the last year" },
        {
            label: "Workspaces done",
            value: `${globalStats.completedRoadmaps}`,
            unit: "",
            sub: `${globalStats.inProgressRoadmaps} in progress`,
        },
    ];

    return (
        <div className="studio-page">
            <header className="app-header-block">
                <h1>Analytics</h1>
                <p className="text-sm text-text-muted">Consistency and progress across your workspaces.</p>
            </header>

            {mounted ? (
                <>
                    <dl className="app-stat-grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
                        {kpis.map((kpi) => (
                            <div key={kpi.label} className="app-stat-card">
                                <dt className="text-[13px] text-text-soft">{kpi.label}</dt>
                                <dd className="text-2xl tabular-nums text-text">
                                    {kpi.value}
                                    {kpi.unit ? <span className="ml-1 text-sm text-text-soft">{kpi.unit}</span> : null}
                                </dd>
                                <dd className="text-xs tabular-nums text-text-soft">{kpi.sub}</dd>
                            </div>
                        ))}
                    </dl>

                    <section aria-labelledby="matrix-heading" className="rounded-2xl bg-surface p-[22px]">
                        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                            <h2 id="matrix-heading" className="text-base text-text">
                                Consistency
                            </h2>
                            <span className="text-xs tabular-nums text-text-soft">
                                {activeDays} active day{activeDays === 1 ? "" : "s"} in the last year
                            </span>
                        </div>
                        <ConsistencyMatrix cells={cells} />
                    </section>

                    <div className="grid items-start gap-[14px] lg:grid-cols-2">
                        <section aria-labelledby="progress-heading" className="rounded-2xl bg-surface p-[22px]">
                            <div className="flex items-baseline justify-between gap-2">
                                <h2 id="progress-heading" className="text-base text-text">
                                    Workspace progress
                                </h2>
                                <Link to="/workspaces" className="text-xs text-text-muted hover:text-text">
                                    View all
                                </Link>
                            </div>
                            {topRoadmaps.length === 0 ? (
                                <p className="studio-empty mt-4 px-4 py-3 text-[13px] text-text-soft">
                                    No workspace has tasks yet.
                                </p>
                            ) : (
                                <ul className="mt-2">
                                    {topRoadmaps.map(({ roadmap, stats }) => (
                                        <li key={roadmap.id} className="border-t border-border first:border-t-0">
                                            <Link
                                                to="/workspace/$id"
                                                params={{ id: roadmap.id }}
                                                className="block py-3 text-text hover:text-text-muted"
                                            >
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="truncate text-sm">{roadmap.title || "Untitled workspace"}</span>
                                                    <span className="shrink-0 text-[13px] tabular-nums">{stats.percent}%</span>
                                                </div>
                                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
                                                    <div
                                                        className={`h-full rounded-full ${stats.progressState === "completed" ? "bg-success" : "bg-accent"}`}
                                                        style={{ width: `${stats.percent}%` }}
                                                    />
                                                </div>
                                                <p className="mt-1.5 text-xs tabular-nums text-text-soft">
                                                    {stats.completedTasks} of {stats.totalTasks} tasks · {stats.moduleCount} module
                                                    {stats.moduleCount === 1 ? "" : "s"}
                                                </p>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section aria-labelledby="milestones-heading" className="rounded-2xl bg-surface p-[22px]">
                            <h2 id="milestones-heading" className="text-base text-text">
                                Milestones
                            </h2>
                            {milestones.length === 0 ? (
                                <p className="studio-empty mt-4 px-4 py-3 text-[13px] text-text-soft">
                                    Finish a module to record your first milestone.
                                </p>
                            ) : (
                                <ul className="mt-2">
                                    {milestones.slice(0, 6).map((ms) => (
                                        <li
                                            key={ms.id}
                                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-border py-3 first:border-t-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm text-text">{ms.label}</p>
                                                <Link
                                                    to="/workspace/$id"
                                                    params={{ id: ms.roadmapId }}
                                                    className="mt-0.5 block truncate text-xs text-text-soft hover:text-text"
                                                >
                                                    {MILESTONE_LABELS[ms.type]} · {ms.roadmapTitle}
                                                </Link>
                                            </div>
                                            <time dateTime={ms.completedAt} className="text-xs tabular-nums text-text-soft">
                                                {new Date(ms.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </time>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-[14px]" aria-hidden="true">
                    <div className="skeleton h-[106px] rounded-2xl" />
                    <div className="skeleton h-56 rounded-2xl" />
                    <div className="grid gap-[14px] lg:grid-cols-2">
                        <div className="skeleton h-48 rounded-2xl" />
                        <div className="skeleton h-48 rounded-2xl" />
                    </div>
                </div>
            )}
        </div>
    );
}
