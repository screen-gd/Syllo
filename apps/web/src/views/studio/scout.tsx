import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScoutProgress from "@/components/scout/ScoutProgress";
import PickList from "@/components/scout/PickList";
import SourcesPanel from "@/components/scout/SourcesPanel";
import ManualRoadmap from "@/components/scout/ManualRoadmap";
import { LEARNING_LEVELS, type LearningLevel, type ModuleSection, type Roadmap } from "@/types";
import { LEVEL_LABEL } from "@/lib/ladder";
import { scoutApi } from "@/lib/scout/api-client";
import { getLastScoutPack, publishScoutPack } from "@/lib/scout/client";
import { humanDuration } from "@/lib/scout/format";
import type { ScoutPackDetail } from "@/lib/scout/pack";
import type {
    ScoutPack,
    ScoutResource,
    ScoutSettings,
    ScoutSource,
    SpendSummary,
} from "@/lib/scout/types";
import { getStorage } from "@/lib/storage";
import {
    getActiveApiKey,
    getActiveModel,
    getUserConfig,
} from "@/lib/userConfig";

const EXAMPLES = [
    "Use coding agents effectively",
    "Build AI features",
    "UI design for developers",
];

const RUNNING_STAGE: Record<string, string> = {
    discovering: "Looking through your sources for free resources.",
    processing: "Reading transcripts and tagging skills.",
    building: "Arranging your picks into modules and review cards.",
};

function detailOf(pack: ScoutPack): ScoutPackDetail {
    return { ...pack, roadmap: null, quizzes: [] };
}

function errorMessage(error: unknown) {
    return error instanceof Error && error.message
        ? error.message
        : "Scout ran into a problem.";
}

/** How a past goal reads in the list: one pale pill per state. */
const PACK_STATUS: Record<
    ScoutPack["status"],
    { label: string; className: string }
> = {
    discovering: { label: "Finding", className: "studio-badge" },
    processing: { label: "Reading", className: "studio-badge" },
    review: {
        label: "Needs review",
        className: "studio-badge bg-warning-soft text-warning",
    },
    building: { label: "Building", className: "studio-badge" },
    ready: {
        label: "Built",
        className: "studio-badge bg-success-soft text-success",
    },
    failed: {
        label: "Stopped",
        className: "studio-badge bg-danger-soft text-danger",
    },
};

export default function ScoutPage() {
    const navigate = useNavigate();
    const [goal, setGoal] = useState("");
    const [startingPoint, setStartingPoint] = useState("");
    const [outcome, setOutcome] = useState("");
    const [draftRoadmap, setDraftRoadmap] = useState<Roadmap | null>(null);
    const [pack, setPack] = useState<ScoutPackDetail | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [starting, setStarting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [settings, setSettings] = useState<ScoutSettings | null>(null);
    const [spend, setSpend] = useState<SpendSummary | null>(null);
    const [sources, setSources] = useState<ScoutSource[]>([]);
    const [books, setBooks] = useState<ScoutResource[]>([]);
    const [recentPacks, setRecentPacks] = useState<ScoutPack[]>([]);
    const [lastPackTitle, setLastPackTitle] = useState<string | null>(null);
    const [lastPackHref, setLastPackHref] = useState<string | null>(null);

    // Load panel data and resume any pack that is still moving.
    useEffect(() => {
        let alive = true;

        void (async () => {
            const [settingsResult, sourcesResult, libraryResult, recentResult] =
                await Promise.allSettled([
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
            if (sourcesResult.status === "fulfilled")
                setSources(sourcesResult.value.sources);
            if (libraryResult.status === "fulfilled")
                setBooks(libraryResult.value.books);

            const last = getLastScoutPack();
            if (last) {
                setLastPackTitle(last.title);
                setLastPackHref(last.roadmapId);
            }

            if (recentResult.status !== "fulfilled") return;
            const packs = recentResult.value.packs;
            setRecentPacks(packs);
            const active = packs.find((item) =>
                ["discovering", "processing", "review", "building"].includes(
                    item.status,
                ),
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

            const ready = packs.find(
                (item) => item.status === "ready" && item.roadmapId,
            );
            if (ready?.roadmapId && !getStorage().getRoadmap(ready.roadmapId)) {
                try {
                    const fresh = await scoutApi.getPack(ready.id);
                    if (!alive) return;
                    setPack(fresh.pack);
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
    const running = Boolean(
        packStatus &&
            ["discovering", "processing", "building"].includes(packStatus),
    );

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
        setSelected(new Set(reviewPack.picks));
    }, [reviewPack]);

    // Publishing is client-side: the server returns the roadmap, the browser
    // writes it into the same store the rest of the studio reads.
    useEffect(() => {
        if (pack?.status !== "ready" || !pack.roadmap) return;
        setDraftRoadmap((current) =>
            current?.id === pack.roadmap?.id ? current : pack.roadmap,
        );
    }, [pack]);

    const step: 1 | 2 | 3 = !pack
        ? 1
        : packStatus === "building" || packStatus === "ready"
          ? 3
          : 2;

    const picks = useMemo(() => pack?.resources ?? [], [pack]);
    const draftGroups = useMemo(() => {
        if (!draftRoadmap) return [];
        const sections = draftRoadmap.sections.filter(
            (section): section is ModuleSection => section.type === "module",
        );
        const groups: Array<{
            key: LearningLevel | "reading";
            heading: string;
            sections: ModuleSection[];
        }> = [];
        for (const level of LEARNING_LEVELS) {
            const at = sections.filter(
                (section) =>
                    section.track !== "reading" &&
                    (section.level ?? "basics") === level,
            );
            if (at.length > 0)
                groups.push({ key: level, heading: LEVEL_LABEL[level], sections: at });
        }
        const reading = sections.filter((section) => section.track === "reading");
        if (reading.length > 0)
            groups.push({ key: "reading", heading: "Reading track", sections: reading });
        return groups;
    }, [draftRoadmap]);
    const selectedMinutes = useMemo(() => {
        const seconds = picks
            .filter((resource) => selected.has(resource.id))
            .reduce(
                (total, resource) => total + (resource.durationSeconds ?? 0),
                0,
            );
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
                goal: [
                    clean,
                    startingPoint.trim()
                        ? `Starting point: ${startingPoint.trim()}`
                        : "",
                    outcome.trim() ? `Desired outcome: ${outcome.trim()}` : "",
                ]
                    .filter(Boolean)
                    .join("\n"),
                provider: config.provider,
                model: getActiveModel(config),
                apiKey,
            });
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
        setPack(null);
        setSelected(new Set());
        setError(null);
    }

    function renameDraftTask(sectionId: string, taskId: string, title: string) {
        setDraftRoadmap((current) =>
            current
                ? {
                      ...current,
                      sections: current.sections.map((section) =>
                          section.type === "module" && section.id === sectionId
                              ? {
                                    ...section,
                                    data: {
                                        ...section.data,
                                        tasks: section.data.tasks.map((task) =>
                                            task.id === taskId
                                                ? { ...task, title }
                                                : task,
                                        ),
                                    },
                                }
                              : section,
                      ),
                  }
                : current,
        );
    }

    async function addSource(input: {
        kind: ScoutSource["kind"];
        label?: string;
        value: string;
    }) {
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
        const result = await scoutApi.addResource({
            kind: "book",
            title,
            outline: chapters,
        });
        setBooks((current) => [
            result.resource,
            ...current.filter((book) => book.id !== result.resource.id),
        ]);
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
        <div className="studio-page sy-scout-page">
            <header className="sy-page-head">
                <div>
                    <h1>Scout</h1>
                    <p className="max-w-2xl text-sm text-text-muted">
                        Describe a goal, review the resources, and approve an
                        editable learning roadmap.
                    </p>
                </div>
            </header>

            <div className="sy-scout-grid">
                <div className="sy-panel sy-scout-main">
                    <ScoutProgress
                        step={step}
                        detail={
                            pack && RUNNING_STAGE[pack.status]
                                ? pack.stage
                                : undefined
                        }
                    />

                    <div aria-live="polite" className="mt-6">
                        {!pack ? (
                            <section
                                aria-labelledby="scout-goal-heading"
                                className="space-y-5"
                            >
                                <div>
                                    <h2
                                        id="scout-goal-heading"
                                        className="text-base text-text"
                                    >
                                        What do you want to learn?
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-text-muted">
                                        One sentence is enough. Scout will find
                                        a mix of videos, articles and docs.
                                    </p>
                                </div>

                                <Input
                                    aria-label="Learning goal"
                                    value={goal}
                                    onChange={(event) =>
                                        setGoal(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !starting)
                                            void start();
                                    }}
                                    placeholder="UI design for developers"
                                    className="h-11 text-[15px]"
                                    maxLength={400}
                                />

                                <div className="flex flex-wrap gap-2">
                                    {EXAMPLES.map((example) => (
                                        <button
                                            key={example}
                                            type="button"
                                            onClick={() => setGoal(example)}
                                            className="sy-button secondary sy-example"
                                        >
                                            {example}
                                        </button>
                                    ))}
                                </div>

                                <label className="sy-form">
                                    What do you already know?
                                    <Input
                                        value={startingPoint}
                                        onChange={(event) =>
                                            setStartingPoint(event.target.value)
                                        }
                                        maxLength={300}
                                        placeholder="Your starting point, in a sentence"
                                    />
                                </label>
                                <label className="sy-form">
                                    What would you like to be able to do?
                                    <Input
                                        value={outcome}
                                        onChange={(event) =>
                                            setOutcome(event.target.value)
                                        }
                                        maxLength={300}
                                        placeholder="A practical outcome"
                                    />
                                </label>

                                <div className="flex flex-wrap items-center gap-4">
                                    <Button
                                        type="button"
                                        onClick={() => void start()}
                                        disabled={starting}
                                    >
                                        {starting ? (
                                            <Loader2 size={15} />
                                        ) : (
                                            <Sparkles size={15} />
                                        )}
                                        {starting ? "Starting" : "Start Scout"}
                                    </Button>
                                    <p className="text-xs text-text-soft">
                                        Uses free Gemini allowances. No paid
                                        fallback.
                                    </p>
                                </div>

                                {recentPacks.length > 0 ? (
                                    <div className="border-t border-border pt-5">
                                        <h3 className="text-[13px] text-text-soft">
                                            Past goals
                                        </h3>
                                        <ul className="mt-1">
                                            {recentPacks
                                                .slice(0, 6)
                                                .map((item) => (
                                                    <li
                                                        key={item.id}
                                                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-t border-border py-2.5 first:border-t-0"
                                                    >
                                                        {item.roadmapId &&
                                                        item.status ===
                                                            "ready" ? (
                                                            <Link
                                                                to="/workspace/$id"
                                                                params={{
                                                                    id: item.roadmapId,
                                                                }}
                                                                className="truncate text-sm text-text hover:underline hover:underline-offset-4"
                                                            >
                                                                {item.goal}
                                                            </Link>
                                                        ) : (
                                                            <span className="truncate text-sm text-text-muted">
                                                                {item.goal}
                                                            </span>
                                                        )}
                                                        <span
                                                            className={
                                                                PACK_STATUS[
                                                                    item.status
                                                                ].className
                                                            }
                                                        >
                                                            {
                                                                PACK_STATUS[
                                                                    item.status
                                                                ].label
                                                            }
                                                        </span>
                                                        <time
                                                            dateTime={
                                                                item.createdAt
                                                            }
                                                            className="text-xs tabular-nums text-text-soft"
                                                        >
                                                            {new Date(
                                                                item.createdAt,
                                                            ).toLocaleDateString(
                                                                "en-US",
                                                                {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                },
                                                            )}
                                                        </time>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                ) : lastPackHref ? (
                                    <div className="border-t border-border pt-5">
                                        <p className="text-[13px] text-text-soft">
                                            Last Scout workspace
                                        </p>
                                        <Link
                                            to="/workspace/$id"
                                            params={{ id: lastPackHref }}
                                            className="mt-2 inline-flex items-center gap-2 text-sm text-text hover:underline hover:underline-offset-4"
                                        >
                                            {lastPackTitle ?? "Open workspace"}{" "}
                                            <ArrowRight
                                                size={14}
                                                className="text-text-soft"
                                            />
                                        </Link>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}
                        {!pack && <ManualRoadmap />}

                        {pack &&
                        ["discovering", "processing", "building"].includes(
                            pack.status,
                        ) ? (
                            <section
                                aria-labelledby="scout-running-heading"
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-3">
                                    <Loader2
                                        size={16}
                                        className="text-text-soft"
                                    />
                                    <h2
                                        id="scout-running-heading"
                                        className="text-lg text-text"
                                    >
                                        {pack.status === "building"
                                            ? "Building your roadmap"
                                            : "Finding your resources"}
                                    </h2>
                                </div>
                                <p className="text-sm leading-6 text-text-muted">
                                    {pack.stage}
                                </p>

                                <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                                    <div
                                        className="h-full rounded-full bg-accent transition-[width] duration-700"
                                        style={{
                                            width: `${Math.max(4, Math.min(100, pack.progress))}%`,
                                        }}
                                    />
                                </div>

                                <p className="text-xs leading-5 text-text-soft">
                                    You can close this tab. Scout keeps working
                                    on the server; come back to approve the
                                    picks.
                                </p>

                                {pack.resources.length > 0 ? (
                                    <div>
                                        <p className="text-xs text-text-soft">
                                            Found so far
                                        </p>
                                        <ul className="mt-2 space-y-1.5">
                                            {pack.resources
                                                .slice(0, 8)
                                                .map((resource) => (
                                                    <li
                                                        key={resource.id}
                                                        className="flex items-baseline justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0"
                                                    >
                                                        <span className="truncate text-text-muted">
                                                            {resource.title}
                                                        </span>
                                                        <span className="shrink-0 text-xs text-text-soft">
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
                            <section
                                aria-labelledby="scout-review-heading"
                                className="space-y-5"
                            >
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <h2
                                            id="scout-review-heading"
                                            className="text-lg text-text"
                                        >
                                            Keep the picks worth your time
                                        </h2>
                                        <p className="mt-1 text-sm leading-6 text-text-muted">
                                            {picks.length} found ·{" "}
                                            {selected.size} kept
                                            {selectedMinutes > 0
                                                ? ` · ~${humanDuration(selectedMinutes * 60)} of video`
                                                : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setSelected(
                                                    new Set(
                                                        picks.map(
                                                            (resource) =>
                                                                resource.id,
                                                        ),
                                                    ),
                                                )
                                            }
                                        >
                                            Select all
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setSelected(new Set())
                                            }
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {failedResources > 0 ? (
                                    <p className="rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning">
                                        {failedResources} resource
                                        {failedResources === 1 ? "" : "s"} could
                                        not be read and will be skipped.
                                    </p>
                                ) : null}

                                <PickList
                                    resources={picks}
                                    selected={selected}
                                    onToggle={togglePick}
                                />

                                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                                    <p className="text-xs text-text-soft">
                                        Roadmap and review cards are built only
                                        from the picks you keep.
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={() => void approve()}
                                        disabled={
                                            approving || selected.size === 0
                                        }
                                    >
                                        {approving ? (
                                            <Loader2 size={15} />
                                        ) : null}
                                        {approving
                                            ? "Building"
                                            : `Keep ${selected.size} and build`}
                                    </Button>
                                </div>

                                <button
                                    type="button"
                                    onClick={reset}
                                    className="text-xs text-text-soft underline-offset-4 hover:text-text hover:underline"
                                >
                                    Start over with a different goal
                                </button>
                            </section>
                        ) : null}

                        {pack?.status === "ready" ? (
                            <section
                                aria-labelledby="scout-ready-heading"
                                className="space-y-4"
                            >
                                <h2
                                    id="scout-ready-heading"
                                    className="text-lg text-text"
                                >
                                    Review your roadmap draft
                                </h2>
                                <p className="text-sm leading-6 text-text-muted">
                                    Change the title or task wording before
                                    keeping this plan. You can edit its full
                                    structure afterward.
                                </p>
                                {draftRoadmap && (
                                    <div className="sy-form">
                                        <label>
                                            Roadmap title
                                            <Input
                                                value={draftRoadmap.title}
                                                onChange={(event) =>
                                                    setDraftRoadmap({
                                                        ...draftRoadmap,
                                                        title: event.target
                                                            .value,
                                                    })
                                                }
                                            />
                                        </label>
                                        <p className="sy-form-hint">
                                            {draftRoadmap.summary}
                                        </p>
                                        {draftGroups.map((group) => (
                                            <section key={group.key}>
                                                <h3>{group.heading}</h3>
                                                {group.sections.map((section) => (
                                                    <div
                                                        className="sy-form"
                                                        style={{ marginTop: 10 }}
                                                        key={section.id}
                                                    >
                                                        <p className="sy-form-hint">
                                                            {section.title}
                                                        </p>
                                                        {section.data.tasks.map(
                                                            (task) => (
                                                                <label key={task.id}>
                                                                    <span className="flex items-center gap-2">
                                                                        Task
                                                                        <span className="studio-badge text-text-muted">
                                                                            {group.key === "reading"
                                                                                ? "Reading"
                                                                                : task.core
                                                                                  ? "Core"
                                                                                  : "Go deeper"}
                                                                        </span>
                                                                    </span>
                                                                    <Input
                                                                        value={task.title}
                                                                        onChange={(event) =>
                                                                            renameDraftTask(
                                                                                section.id,
                                                                                task.id,
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                    {task.core && task.coreReason ? (
                                                                        <p className="sy-form-hint">
                                                                            {task.coreReason}
                                                                        </p>
                                                                    ) : null}
                                                                </label>
                                                            ),
                                                        )}
                                                    </div>
                                                ))}
                                            </section>
                                        ))}
                                        <div>
                                            <Button
                                                disabled={
                                                    !draftRoadmap.title.trim()
                                                }
                                                onClick={() => {
                                                    if (!pack || !draftRoadmap)
                                                        return;
                                                    const id = publishScoutPack(
                                                        {
                                                            ...pack,
                                                            roadmap:
                                                                draftRoadmap,
                                                        },
                                                    );
                                                    if (id)
                                                        void navigate({
                                                            to: "/learn",
                                                            search: {
                                                                roadmap: id,
                                                            },
                                                        });
                                                }}
                                            >
                                                Keep roadmap and start learning
                                                <ArrowRight size={15} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        ) : null}

                        {pack?.status === "failed" ? (
                            <section
                                aria-labelledby="scout-failed-heading"
                                className="space-y-4"
                            >
                                <h2
                                    id="scout-failed-heading"
                                    className="text-lg text-text"
                                >
                                    Scout could not finish that pack
                                </h2>
                                <p className="text-sm leading-6 text-text-muted">
                                    {pack.error ??
                                        "The run stopped early. Your library and settings are unchanged."}
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={reset}
                                >
                                    Try another goal
                                </Button>
                            </section>
                        ) : null}

                        {error ? (
                            <p
                                role="alert"
                                className="mt-5 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
                            >
                                {error}
                            </p>
                        ) : null}

                        {pack && pack.costCents > 0 ? (
                            <p className="mt-6 text-xs text-text-soft">
                                This pack has used an estimated $
                                {(pack.costCents / 100).toFixed(4)} so far.
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
