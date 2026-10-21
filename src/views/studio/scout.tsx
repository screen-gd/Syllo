import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScoutProgress from "@/components/scout/ScoutProgress";
import PickList from "@/components/scout/PickList";
import SourcesPanel from "@/components/scout/SourcesPanel";
import { scoutApi } from "@/lib/scout/api-client";
import {
    getLastScoutPack,
    publishScoutPack,
} from "@/lib/scout/client";
import { humanDuration } from "@/lib/scout/format";
import type { ScoutPackDetail } from "@/lib/scout/pack";
import type { ScoutPack, ScoutResource, ScoutSettings, ScoutSource, SpendSummary } from "@/lib/scout/types";
import { getStorage } from "@/lib/storage";
import { getActiveApiKey, getActiveModel, getUserConfig } from "@/lib/userConfig";

const EXAMPLES = ["UI design for developers", "Rust ownership", "SQL performance"];

const RUNNING_STAGE: Record<string, string> = {
    discovering: "Looking through your sources for free resources.",
    processing: "Reading transcripts and tagging skills.",
    building: "Arranging your picks into modules and review cards.",
};

function detailOf(pack: ScoutPack): ScoutPackDetail {
    return { ...pack, roadmap: null, quizzes: [] };
}

function errorMessage(error: unknown) {
    return error instanceof Error && error.message ? error.message : "Scout ran into a problem.";
}

export default function ScoutPage() {
    const navigate = useNavigate();
    const [goal, setGoal] = useState("");
    const [pack, setPack] = useState<ScoutPackDetail | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [starting, setStarting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [settings, setSettings] = useState<ScoutSettings | null>(null);
    const [spend, setSpend] = useState<SpendSummary | null>(null);
    const [sources, setSources] = useState<ScoutSource[]>([]);
    const [books, setBooks] = useState<ScoutResource[]>([]);
    const [lastPackTitle, setLastPackTitle] = useState<string | null>(null);
    const [lastPackHref, setLastPackHref] = useState<string | null>(null);

    const published = useRef<string | null>(null);

    // Load panel data and resume any pack that is still moving.
    useEffect(() => {
        let alive = true;

        void (async () => {
            const [settingsResult, sourcesResult, libraryResult, recentResult] = await Promise.allSettled([
                scoutApi.getSettings(),
                scoutApi.listSources(),
                scoutApi.listResources({ limit: 40 }),
                scoutApi.recent(),
            ]);

            if (!alive) return;

            if (settingsResult.status === "fulfilled") {
                setSettings(settingsResult.value.settings);
                setSpend(settingsResult.value.spend);
            }
            if (sourcesResult.status === "fulfilled") setSources(sourcesResult.value.sources);
            if (libraryResult.status === "fulfilled") setBooks(libraryResult.value.books);

            const last = getLastScoutPack();
            if (last) {
                setLastPackTitle(last.title);
                setLastPackHref(last.roadmapId);
            }

            if (recentResult.status !== "fulfilled") return;
            const packs = recentResult.value.packs;
            const active = packs.find((item) =>
                ["discovering", "processing", "review", "building"].includes(item.status),
            );

            if (active) {
                try {
                    const fresh = await scoutApi.getPack(active.id);
                    if (alive) {
                        setPack(fresh.pack);
                        setGoal(fresh.pack.goal);
                    }
                } catch {
                    // A stale pack id is not worth blocking the page.
                }
                return;
            }

            const ready = packs.find((item) => item.status === "ready" && item.roadmapId);
            if (ready?.roadmapId && !getStorage().getRoadmap(ready.roadmapId)) {
                try {
                    const fresh = await scoutApi.getPack(ready.id);
                    if (!alive) return;
                    const id = publishScoutPack(fresh.pack);
                    if (id) navigate({ to: "/workspace/$id", params: { id } });
                } catch {
                    // Ignore: the learner can still start a new pack.
                }
            }
        })();

        return () => {
            alive = false;
        };
    }, [navigate]);

    const packId = pack?.id;
    const packStatus = pack?.status;
    const running = Boolean(packStatus && ["discovering", "processing", "building"].includes(packStatus));

    // Poll while the server is working. The queue runs server-side, so closing
    // the tab does not stop a pack.
    useEffect(() => {
        if (!packId || !running || !packStatus) return;

        const timer = setInterval(() => {
            void (async () => {
                try {
                    const fresh = await scoutApi.getPack(packId);
                    setPack(fresh.pack);
                } catch (pollError) {
                    setError(errorMessage(pollError));
                }
            })();
        }, 2000);

        return () => clearInterval(timer);
    }, [packId, packStatus, running]);

    // A pack in review starts with every pick selected.
    const reviewPack = packStatus === "review" ? pack : null;
    useEffect(() => {
        if (!reviewPack) return;
        setSelected(
            new Set(reviewPack.picks.length > 0 ? reviewPack.picks : reviewPack.resources.map((resource) => resource.id)),
        );
    }, [reviewPack]);

    // Publishing is client-side: the server returns the roadmap, the browser
    // writes it into the same store the rest of the studio reads.
    useEffect(() => {
        if (pack?.status !== "ready" || !pack.roadmap) return;
        if (published.current === pack.id) return;
        published.current = pack.id;

        const id = publishScoutPack(pack);
        if (id) navigate({ to: "/workspace/$id", params: { id } });
    }, [pack, navigate]);

    const step: 1 | 2 | 3 = !pack ? 1 : packStatus === "building" || packStatus === "ready" ? 3 : 2;

    const picks = useMemo(() => pack?.resources ?? [], [pack]);
    const selectedMinutes = useMemo(() => {
        const seconds = picks
            .filter((resource) => selected.has(resource.id))
            .reduce((total, resource) => total + (resource.durationSeconds ?? 0), 0);
        return Math.round(seconds / 60);
    }, [picks, selected]);

    const failedResources = picks.filter((resource) => resource.error).length;

    function togglePick(id: string) {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function start() {
        const clean = goal.trim();
        if (clean.length < 4) {
            setError("Tell Scout what you want to learn, in a few words.");
            return;
        }

        setStarting(true);
        setError(null);

        try {
            const config = getUserConfig();
            const apiKey = config.useCustomKey ? getActiveApiKey(config) : "";
            const result = await scoutApi.start({
                goal: clean,
                provider: config.provider,
                model: getActiveModel(config),
                apiKey,
            });
            published.current = null;
            setPack(detailOf(result.pack));
        } catch (startError) {
            setError(errorMessage(startError));
        } finally {
            setStarting(false);
        }
    }

    async function approve() {
        if (!pack) return;
        if (selected.size === 0) {
            setError("Keep at least one resource before building the roadmap.");
            return;
        }

        setApproving(true);
        setError(null);

        try {
            const result = await scoutApi.approve(pack.id, [...selected]);
            setPack(result.pack);
        } catch (approveError) {
            setError(errorMessage(approveError));
        } finally {
            setApproving(false);
        }
    }

    function reset() {
        published.current = null;
        setPack(null);
        setSelected(new Set());
        setError(null);
    }

    async function addSource(input: { kind: ScoutSource["kind"]; label?: string; value: string }) {
        const result = await scoutApi.addSource(input);
        setSources(result.sources);
    }

    async function removeSource(id: string) {
        const result = await scoutApi.removeSource(id);
        setSources(result.sources);
    }

    async function toggleSource(id: string, enabled: boolean) {
        const result = await scoutApi.toggleSource(id, enabled);
        setSources(result.sources);
    }

    async function addBook(title: string, chapters: string[]) {
        const result = await scoutApi.addResource({ kind: "book", title, outline: chapters });
        setBooks((current) => [result.resource, ...current.filter((book) => book.id !== result.resource.id)]);
    }

    async function addUrl(url: string, note?: string) {
        await scoutApi.addResource({ url, note });
    }

    async function toggleAutoCheck(enabled: boolean) {
        const result = await scoutApi.patchSettings({ autoCheck: enabled });
        setSettings(result.settings);
        setSpend(result.spend);
    }

    async function pauseScout(paused: boolean) {
        const result = await scoutApi.patchSettings({ paused });
        setSettings(result.settings);
        setSpend(result.spend);
    }

    return (
        <div className="studio-page">
            <header className="app-header-block">
                <p className="eyebrow">Scout</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-display leading-[0.98] tracking-tight text-[var(--color-text)] md:text-5xl">
                    Free resources, arranged into a path.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-muted)]">
                    Scout reads free videos, articles and docs, tags the skills they teach, and turns the picks you keep into a
                    workspace. Videos are never re-hosted, and raw transcripts stay on this machine.
                </p>
            </header>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
                <div className="min-w-0">
                    <ScoutProgress step={step} detail={pack && RUNNING_STAGE[pack.status] ? pack.stage : undefined} />

                    <div aria-live="polite" className="mt-6">
                        {!pack ? (
                            <section aria-labelledby="scout-goal-heading" className="space-y-5">
                                <div>
                                    <h2 id="scout-goal-heading" className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                                        What do you want to learn?
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                                        One sentence is enough. Scout will find a mix of videos, articles and docs.
                                    </p>
                                </div>

                                <Input
                                    aria-label="Learning goal"
                                    value={goal}
                                    onChange={(event) => setGoal(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !starting) void start();
                                    }}
                                    placeholder="UI design for developers"
                                    className="h-12 text-base"
                                    maxLength={400}
                                />

                                <div className="flex flex-wrap gap-2">
                                    {EXAMPLES.map((example) => (
                                        <button
                                            key={example}
                                            type="button"
                                            onClick={() => setGoal(example)}
                                            className="border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <Button type="button" onClick={() => void start()} disabled={starting}>
                                        {starting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                        {starting ? "Starting" : "Start Scout"}
                                    </Button>
                                    <p className="text-xs text-[var(--color-text-soft)]">
                                        Uses your provider key from Settings. DeepSeek is the default.
                                    </p>
                                </div>

                                {lastPackHref ? (
                                    <div className="border-t border-[var(--color-border)] pt-5">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                                            Last Scout workspace
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-3">
                                            <Link
                                                to="/workspace/$id"
                                                params={{ id: lastPackHref }}
                                                className="text-sm text-[var(--color-text)] underline-offset-4 hover:underline"
                                            >
                                                {lastPackTitle ?? "Open workspace"}
                                            </Link>
                                            <ArrowRight size={14} className="text-[var(--color-text-soft)]" aria-hidden="true" />
                                        </div>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}

                        {pack && ["discovering", "processing", "building"].includes(pack.status) ? (
                            <section aria-labelledby="scout-running-heading" className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <Loader2 size={16} className="animate-spin text-[var(--color-accent)]" />
                                    <h2 id="scout-running-heading" className="font-display text-2xl text-[var(--color-text)]">
                                        {pack.status === "building" ? "Building your roadmap" : "Finding your resources"}
                                    </h2>
                                </div>
                                <p className="text-sm leading-7 text-[var(--color-text-muted)]">{pack.stage}</p>

                                <div className="h-1.5 overflow-hidden border border-[var(--color-border)] bg-black/40">
                                    <div
                                        className="h-full bg-[var(--color-accent)] transition-[width] duration-700"
                                        style={{ width: `${Math.max(4, Math.min(100, pack.progress))}%` }}
                                    />
                                </div>

                                <p className="text-xs leading-5 text-[var(--color-text-soft)]">
                                    You can close this tab. Scout keeps working on the server; come back to approve the picks.
                                </p>

                                {pack.resources.length > 0 ? (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-soft)]">
                                            Found so far
                                        </p>
                                        <ul className="mt-2 space-y-1.5">
                                            {pack.resources.slice(0, 8).map((resource) => (
                                                <li key={resource.id} className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] py-1.5 text-sm last:border-b-0">
                                                    <span className="truncate text-[var(--color-text-muted)]">{resource.title}</span>
                                                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-soft)]">
                                                        {resource.kind}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}

                        {pack?.status === "review" ? (
                            <section aria-labelledby="scout-review-heading" className="space-y-5">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <h2 id="scout-review-heading" className="font-display text-2xl text-[var(--color-text)]">
                                            Keep the picks worth your time
                                        </h2>
                                        <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                                            {picks.length} found · {selected.size} kept
                                            {selectedMinutes > 0 ? ` · ~${humanDuration(selectedMinutes * 60)} of video` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelected(new Set(picks.map((resource) => resource.id)))}
                                        >
                                            Select all
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {failedResources > 0 ? (
                                    <p className="border-l-2 border-amber-400 pl-3 text-xs leading-5 text-amber-300/90">
                                        {failedResources} resource{failedResources === 1 ? "" : "s"} could not be read and will be skipped.
                                    </p>
                                ) : null}

                                <PickList resources={picks} selected={selected} onToggle={togglePick} />

                                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-5">
                                    <p className="text-xs text-[var(--color-text-soft)]">
                                        Roadmap and review cards are built only from the picks you keep.
                                    </p>
                                    <Button type="button" onClick={() => void approve()} disabled={approving || selected.size === 0}>
                                        {approving ? <Loader2 size={15} className="animate-spin" /> : null}
                                        {approving ? "Building" : `Keep ${selected.size} and build`}
                                    </Button>
                                </div>

                                <button
                                    type="button"
                                    onClick={reset}
                                    className="text-xs text-[var(--color-text-soft)] underline-offset-4 hover:text-[var(--color-text)] hover:underline"
                                >
                                    Start over with a different goal
                                </button>
                            </section>
                        ) : null}

                        {pack?.status === "ready" ? (
                            <section aria-labelledby="scout-ready-heading" className="space-y-4">
                                <h2 id="scout-ready-heading" className="font-display text-2xl text-[var(--color-text)]">
                                    Your workspace is ready
                                </h2>
                                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                                    Opening it now. If nothing happens, use the link below.
                                </p>
                                {pack.roadmapId ? (
                                    <Button asChild>
                                        <Link to="/workspace/$id" params={{ id: pack.roadmapId }}>
                                            Open workspace <ArrowRight size={15} />
                                        </Link>
                                    </Button>
                                ) : null}
                            </section>
                        ) : null}

                        {pack?.status === "failed" ? (
                            <section aria-labelledby="scout-failed-heading" className="space-y-4">
                                <h2 id="scout-failed-heading" className="font-display text-2xl text-[var(--color-text)]">
                                    Scout could not finish that pack
                                </h2>
                                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                                    {pack.error ?? "The run stopped early. Your library and settings are unchanged."}
                                </p>
                                <Button type="button" variant="secondary" onClick={reset}>
                                    Try another goal
                                </Button>
                            </section>
                        ) : null}

                        {error ? (
                            <p role="alert" className="mt-5 border-l-2 border-red-400 pl-3 text-sm leading-6 text-red-300">
                                {error}
                            </p>
                        ) : null}

                        {pack && pack.costCents > 0 ? (
                            <p className="mt-6 text-[11px] text-[var(--color-text-soft)]">
                                This pack has used an estimated ${(pack.costCents / 100).toFixed(4)} so far.
                            </p>
                        ) : null}
                    </div>
                </div>

                <SourcesPanel
                    sources={sources}
                    settings={settings}
                    spend={spend}
                    books={books}
                    onAddSource={addSource}
                    onRemoveSource={removeSource}
                    onToggleSource={toggleSource}
                    onAddBook={addBook}
                    onAddUrl={addUrl}
                    onToggleAutoCheck={toggleAutoCheck}
                    onPause={pauseScout}
                />
            </div>
        </div>
    );
}
