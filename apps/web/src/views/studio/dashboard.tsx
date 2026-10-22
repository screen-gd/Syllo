import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import { scoutApi } from "@/lib/scout/api-client";
import {
    bookPercent,
    getBookshelf,
    getLastScoutPack,
    localWeeklyStats,
    setChapterDone,
    type BookProgress,
    type ScoutLastPack,
    type ScoutLocalStats,
} from "@/lib/scout/client";
import type { ScoutDigest, ScoutResource } from "@/lib/scout/types";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@/types";

function relativeTime(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
}

export default function DashboardPage() {
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [mounted, setMounted] = useState(false);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [lastPack, setLastPack] = useState<ScoutLastPack | null>(null);
    const [weekly, setWeekly] = useState<ScoutLocalStats | null>(null);
    const [digest, setDigest] = useState<ScoutDigest | null>(null);
    const [books, setBooks] = useState<ScoutResource[]>([]);
    const [shelf, setShelf] = useState<Record<string, BookProgress>>({});

    useEffect(() => {
        const storage = getStorage();
        let active = true;

        setMounted(true);
        setRoadmaps(storage.getRoadmaps());
        setCurrentStreak(storage.getLearningRecord().currentStreak);
        setLastPack(getLastScoutPack());
        setShelf(getBookshelf());
        setWeekly(localWeeklyStats());

        void (async () => {
            try {
                const [digestResult, libraryResult] = await Promise.all([
                    scoutApi.getDigest(),
                    scoutApi.listResources({ kind: "book", limit: 12 }),
                ]);
                if (!active) return;

                const local = localWeeklyStats();
                setWeekly(local);
                setDigest({
                    ...digestResult.digest,
                    minutesWatched: local.minutesWatched,
                    tasksCompleted: local.tasksCompleted,
                    reviewDue: local.reviewDue,
                });
                setBooks(libraryResult.books);
                setShelf(getBookshelf());
            } catch {
                // Scout is optional here: local workspaces and the shelf still render.
            }
        })();

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

    function toggleChapter(bookId: string, index: number, done: boolean) {
        setChapterDone(bookId, index, done);
        setShelf(getBookshelf());
    }

    const kpis = [
        { label: "Cards due", value: weekly?.reviewDue ?? 0, unit: "" },
        { label: "Tasks this week", value: weekly?.tasksCompleted ?? 0, unit: "" },
        { label: "Watched this week", value: weekly?.minutesWatched ?? 0, unit: "min" },
        { label: "Streak", value: currentStreak, unit: currentStreak === 1 ? "day" : "days" },
    ];
    const reviewDue = weekly?.reviewDue ?? 0;

    return (
        <div className="studio-page">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="app-header-block">
                    <h1>Home</h1>
                    <p className="text-sm text-text-muted">
                        {mounted && reviewDue > 0
                            ? `${reviewDue} review card${reviewDue === 1 ? "" : "s"} due today.`
                            : "Pick up where you left off."}
                    </p>
                </div>
                <Button asChild>
                    <Link to="/scout">
                        <Sparkles size={15} /> New goal
                    </Link>
                </Button>
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
                            </div>
                        ))}
                    </dl>

                    <section aria-labelledby="continue-heading" className="grid gap-[14px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="flex flex-col rounded-2xl bg-surface p-[22px]">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[13px] text-text-soft">Continue</p>
                                {lastPack ? (
                                    <span className="text-xs text-text-soft">Built by Scout {relativeTime(lastPack.at)}</span>
                                ) : null}
                            </div>

                            {lastPack ? (
                                <>
                                    <h2 id="continue-heading" className="mt-2 text-xl text-text">
                                        {lastPack.title}
                                    </h2>
                                    <p className="mt-1 text-sm text-text-muted">{lastPack.goal}</p>
                                    <div className="mt-auto pt-6">
                                        <Button asChild variant="secondary">
                                            <Link to="/workspace/$id" params={{ id: lastPack.roadmapId }}>
                                                Resume <ArrowRight size={14} />
                                            </Link>
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 id="continue-heading" className="mt-2 text-xl text-text">
                                        Build a workspace from free resources
                                    </h2>
                                    <p className="mt-1 max-w-lg text-sm text-text-muted">
                                        Give Scout a goal. It finds videos, articles and docs, then waits for your approval before
                                        building anything.
                                    </p>
                                    <div className="mt-auto pt-6">
                                        <Button asChild variant="secondary">
                                            <Link to="/scout">Start Scout</Link>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col rounded-2xl bg-surface p-[22px]">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-[13px] font-normal text-text-soft">This week</h2>
                                <Link to="/scout" className="text-xs text-text-muted hover:text-text">
                                    Open Scout
                                </Link>
                            </div>
                            <p className="mt-2 text-sm text-text">
                                {digest?.headline ?? "Scout checks your sources every night at 3:00 AM and saves what is new."}
                            </p>

                            {digest && digest.highlights.length > 0 ? (
                                <ul className="mt-3 flex flex-col">
                                    {digest.highlights.slice(0, 5).map((highlight) => (
                                        <li key={highlight.url} className="border-t border-border first:border-t-0">
                                            <a
                                                href={highlight.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-baseline justify-between gap-3 py-2 text-[13px] text-text-muted hover:text-text"
                                            >
                                                <span className="truncate">{highlight.title}</span>
                                                {highlight.skill ? (
                                                    <span className="shrink-0 text-xs text-text-soft">{highlight.skill}</span>
                                                ) : null}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}

                            {digest && digest.newResources > 0 ? (
                                <p className="mt-auto pt-4 text-xs tabular-nums text-text-soft">
                                    {digest.newResources} new resource{digest.newResources === 1 ? "" : "s"}
                                </p>
                            ) : null}
                        </div>
                    </section>

                    {books.length > 0 ? (
                        <section aria-labelledby="shelf-heading" className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 id="shelf-heading" className="flex items-center gap-2 text-base text-text">
                                    <BookOpen size={16} strokeWidth={1.75} className="text-text-soft" /> Reading shelf
                                    <span className="studio-badge">{books.length}</span>
                                </h2>
                                <Link to="/scout" className="text-[13px] text-text-muted hover:text-text">
                                    Add a book
                                </Link>
                            </div>

                            <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
                                {books.map((book) => {
                                    const progress = shelf[book.id] ?? { completed: [], lastChapter: 0, updatedAt: "" };
                                    const percent = bookPercent(book, progress);
                                    const chapters = book.chapters.length > 0
                                        ? book.chapters
                                        : [{ startSeconds: 0, title: "Read the book", url: book.url }];
                                    const done = progress.completed.filter((index) => index < chapters.length).length;

                                    return (
                                        <article key={book.id} className="flex flex-col rounded-2xl bg-surface p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="text-[15px] font-medium leading-snug text-text">{book.title}</h3>
                                                <span className="shrink-0 text-[13px] tabular-nums text-text-muted">{percent}%</span>
                                            </div>

                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                                                <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                                            </div>
                                            <p className="mt-2 text-xs tabular-nums text-text-soft">
                                                {done} of {chapters.length} chapters
                                            </p>

                                            <ul className="mt-3 flex flex-col gap-1.5">
                                                {chapters.slice(0, 3).map((chapter, index) => {
                                                    const checked = progress.completed.includes(index);
                                                    return (
                                                        <li key={`${book.id}-${index}`} className="flex items-start gap-2">
                                                            <button
                                                                type="button"
                                                                role="checkbox"
                                                                aria-checked={checked}
                                                                aria-label={`Mark ${chapter.title} ${checked ? "not done" : "done"}`}
                                                                onClick={() => toggleChapter(book.id, index, !checked)}
                                                                className={cn(
                                                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                                                                    checked
                                                                        ? "border-text bg-text text-page"
                                                                        : "border-border-strong hover:border-text-soft",
                                                                )}
                                                            >
                                                                {checked ? <Check size={10} strokeWidth={3} /> : null}
                                                            </button>
                                                            <span className={cn("text-[13px] leading-5", checked ? "text-text-soft line-through" : "text-text-muted")}>
                                                                {chapter.title}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                            {chapters.length > 3 ? (
                                                <p className="mt-2 text-xs text-text-soft">+{chapters.length - 3} more</p>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    <section aria-labelledby="active-heading" className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h2 id="active-heading" className="flex items-center gap-2 text-base text-text">
                                Active workspaces
                                {activeRoadmaps.length > 0 ? <span className="studio-badge">{activeRoadmaps.length}</span> : null}
                            </h2>
                            <Link to="/workspaces" className="text-[13px] text-text-muted hover:text-text">
                                View all
                            </Link>
                        </div>
                        {activeRoadmaps.length > 0 ? (
                            <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
                                {activeRoadmaps.map((roadmap) => {
                                    const stats = getRoadmapStats(roadmap);
                                    return (
                                        <Link
                                            key={roadmap.id}
                                            to="/workspace/$id"
                                            params={{ id: roadmap.id }}
                                            className="flex min-h-[160px] flex-col rounded-2xl bg-surface p-5 transition-colors hover:bg-surface-subtle"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-text">
                                                    {roadmap.title || "Untitled workspace"}
                                                </h3>
                                                {roadmap.packVersion ? (
                                                    <span className="studio-badge">Built by Scout</span>
                                                ) : null}
                                            </div>

                                            <div className="mt-auto flex flex-col gap-2 pt-6">
                                                <div className="flex items-center justify-between text-[13px] tabular-nums">
                                                    <span className="text-text">{stats.percent}%</span>
                                                    <span className="text-text-soft">
                                                        {stats.completedTasks} of {stats.totalTasks} tasks
                                                    </span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                                                    <div className="h-full rounded-full bg-accent" style={{ width: `${stats.percent}%` }} />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="studio-empty flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                                <p className="text-sm text-text-muted">No workspace is in progress.</p>
                                <Button asChild variant="secondary" size="sm">
                                    <Link to="/create">Create a workspace</Link>
                                </Button>
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <div className="flex flex-col gap-[14px]" aria-hidden="true">
                    <div className="skeleton h-[86px] rounded-2xl" />
                    <div className="grid gap-[14px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="skeleton h-48 rounded-2xl" />
                        <div className="skeleton h-48 rounded-2xl" />
                    </div>
                </div>
            )}
        </div>
    );
}
