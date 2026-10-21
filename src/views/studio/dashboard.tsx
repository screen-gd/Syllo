import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Flame, Sparkles, Target } from "lucide-react";
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
                    <section aria-labelledby="continue-heading" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                        <div className="border border-white/10 bg-white/5 p-6 rounded-2xl">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Continue</p>
                                {lastPack ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                        Scout · {relativeTime(lastPack.at)}
                                    </span>
                                ) : null}
                            </div>

                            {lastPack ? (
                                <>
                                    <h2 id="continue-heading" className="mt-3 font-display text-2xl text-zinc-100">
                                        {lastPack.title}
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-zinc-400">{lastPack.goal}</p>
                                    <div className="mt-5 flex flex-wrap items-center gap-4">
                                        <Button asChild size="sm">
                                            <Link to="/workspace/$id" params={{ id: lastPack.roadmapId }}>
                                                Resume <ArrowRight size={14} />
                                            </Link>
                                        </Button>
                                        <Link to="/scout" className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline">
                                            Start another pack
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 id="continue-heading" className="mt-3 font-display text-2xl text-zinc-100">
                                        Build a workspace from free resources.
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                                        Give Scout a goal. It finds videos, articles and docs, then waits for your approval before
                                        building anything.
                                    </p>
                                    <Button asChild size="sm" className="mt-5">
                                        <Link to="/scout">
                                            <Sparkles size={14} /> Start Scout
                                        </Link>
                                    </Button>
                                </>
                            )}

                            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                                <div>
                                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Cards due</dt>
                                    <dd className="mt-1 text-xl font-display tabular-nums text-zinc-100">{weekly?.reviewDue ?? 0}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Tasks this week</dt>
                                    <dd className="mt-1 text-xl font-display tabular-nums text-zinc-100">{weekly?.tasksCompleted ?? 0}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Minutes</dt>
                                    <dd className="mt-1 text-xl font-display tabular-nums text-zinc-100">{weekly?.minutesWatched ?? 0}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="border border-white/10 bg-white/5 p-6 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">This week</p>
                            <p className="mt-3 text-sm leading-6 text-zinc-300">
                                {digest?.headline ?? "Scout checks your sources every night at 3:00 AM and saves what is new."}
                            </p>

                            {digest && digest.highlights.length > 0 ? (
                                <ul className="mt-4 space-y-2">
                                    {digest.highlights.map((highlight) => (
                                        <li key={highlight.url}>
                                            <a
                                                href={highlight.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 text-xs text-zinc-400 last:border-b-0 hover:text-zinc-100"
                                            >
                                                <span className="truncate">{highlight.title}</span>
                                                {highlight.skill ? (
                                                    <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                                                        {highlight.skill}
                                                    </span>
                                                ) : null}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-xs leading-5 text-zinc-500">
                                    New resources land here after the nightly check.
                                </p>
                            )}

                            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                <span>
                                    {digest ? `${digest.newResources} new resource${digest.newResources === 1 ? "" : "s"}` : "Library"}
                                </span>
                                <Link to="/scout" className="normal-case tracking-normal text-zinc-500 hover:text-emerald-300">
                                    Open Scout
                                </Link>
                            </div>
                        </div>
                    </section>

                    {books.length > 0 ? (
                        <section aria-labelledby="shelf-heading" className="mt-10">
                            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
                                <h2 id="shelf-heading" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    <BookOpen size={14} /> Reading shelf
                                </h2>
                                <Link to="/scout" className="text-xs text-zinc-500 hover:text-emerald-300">
                                    Add a book
                                </Link>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {books.map((book) => {
                                    const progress = shelf[book.id] ?? { completed: [], lastChapter: 0, updatedAt: "" };
                                    const percent = bookPercent(book, progress);
                                    const chapters = book.chapters.length > 0
                                        ? book.chapters
                                        : [{ startSeconds: 0, title: "Read the book", url: book.url }];
                                    const done = progress.completed.filter((index) => index < chapters.length).length;

                                    return (
                                        <article key={book.id} className="flex flex-col border border-white/10 bg-white/5 p-5 rounded-2xl">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="font-display text-lg leading-tight text-zinc-100">{book.title}</h3>
                                                <span className="shrink-0 text-xs tabular-nums text-emerald-400">{percent}%</span>
                                            </div>

                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-white/5 bg-black/40">
                                                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${percent}%` }} />
                                            </div>
                                            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                                {done} of {chapters.length} chapters
                                            </p>

                                            <ul className="mt-3 space-y-1.5">
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
                                                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                                                                    checked
                                                                        ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                                                                        : "border-white/20 text-transparent hover:border-white/50",
                                                                )}
                                                            >
                                                                <Check size={10} strokeWidth={3} />
                                                            </button>
                                                            <span className={cn("text-xs leading-5", checked ? "text-zinc-600 line-through" : "text-zinc-400")}>
                                                                {chapter.title}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                            {chapters.length > 3 ? (
                                                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                                                    +{chapters.length - 3} more
                                                </p>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}

                    <section className="mt-10">
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
                                                {roadmap.packVersion ? (
                                                    <span className="shrink-0 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                                                        Built by Scout
                                                    </span>
                                                ) : null}
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
