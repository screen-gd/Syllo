import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Icon, Pending, Sparkle } from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemContent,
    ItemGroup,
    ItemTitle,
} from "@/components/glaze/ui/item";
import { Progress } from "@/components/glaze/ui/progress";
import ScoutProgress from "@/components/scout/ScoutProgress";
import PickList from "@/components/scout/PickList";
import SourcesPanel from "@/components/scout/SourcesPanel";
import ManualRoadmap from "@/components/scout/ManualRoadmap";
import PageFrame from "@/components/layout/PageFrame";
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
const PACK_STATUS: Record<ScoutPack["status"], string> = {
    discovering: "Finding",
    processing: "Reading",
    review: "Needs review",
    building: "Building",
    ready: "Built",
    failed: "Stopped",
}

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
        <PageFrame
            title="Scout"
            subtitle="Describe a goal, review the resources, and approve an editable learning roadmap."
        >
            <div className="grid gap-4 lg:grid-cols-3">
                <div
                    aria-live="polite"
                    className="flex flex-col gap-4 lg:col-span-2"
                >
                    <div className="shell">
                        <div className="panel p-3">
                            <ScoutProgress
                                step={step}
                                detail={
                                    pack && RUNNING_STAGE[pack.status]
                                        ? pack.stage
                                        : undefined
                                }
                            />

                            <div className="mt-6">
                            {!pack ? (
                                <section
                                    aria-labelledby="scout-goal-heading"
                                    className="flex flex-col gap-5"
                                >
                                    <div>
                                        <h2
                                            id="scout-goal-heading"
                                            className="type-heading-sm"
                                        >
                                            What do you want to learn?
                                        </h2>
                                        <p className="mt-1 type-body-sm text-text-2">
                                            One sentence is enough. Scout will
                                            find a mix of videos, articles and
                                            docs.
                                        </p>
                                    </div>

                                    <Input
                                        aria-label="Learning goal"
                                        size="lg"
                                        value={goal}
                                        onValueChange={setGoal}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" &&
                                                !starting
                                            )
                                                void start();
                                        }}
                                        placeholder="UI design for developers"
                                        maxLength={400}
                                    />

                                    <div className="flex flex-wrap gap-2">
                                        {EXAMPLES.map((example) => (
                                            <Button
                                                key={example}
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setGoal(example)}
                                            >
                                                {example}
                                            </Button>
                                        ))}
                                    </div>

                                    <Field>
                                        <FieldLabel>
                                            What do you already know?
                                        </FieldLabel>
                                        <Input
                                            value={startingPoint}
                                            onValueChange={setStartingPoint}
                                            maxLength={300}
                                            placeholder="Your starting point, in a sentence"
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>
                                            What would you like to be able to
                                            do?
                                        </FieldLabel>
                                        <Input
                                            value={outcome}
                                            onValueChange={setOutcome}
                                            maxLength={300}
                                            placeholder="A practical outcome"
                                        />
                                    </Field>

                                    <div className="flex flex-wrap items-center gap-4">
                                        <Button
                                            pending={starting}
                                            onClick={() => void start()}
                                        >
                                            {!starting ? (
                                                <Icon icon={Sparkle} />
                                            ) : null}
                                            {starting
                                                ? "Starting"
                                                : "Start Scout"}
                                        </Button>
                                        <p className="type-caption text-text-2">
                                            Uses free Gemini allowances. No
                                            paid fallback.
                                        </p>
                                    </div>

                                    {recentPacks.length > 0 ? (
                                        <div className="border-t border-line-faint pt-5">
                                            <h3 className="type-label text-text-2">
                                                Past goals
                                            </h3>
                                            <ItemGroup variant="plain" aria-label="Past goals" className="mt-2">
                                                {recentPacks
                                                    .slice(0, 6)
                                                    .map((item) => (
                                                        <Item
                                                            key={item.id}
                                                            render={
                                                                item.roadmapId &&
                                                                item.status ===
                                                                    "ready" ? (
                                                                    <Link
                                                                        to="/workspace/$id"
                                                                        params={{
                                                                            id: item.roadmapId,
                                                                        }}
                                                                    />
                                                                ) : undefined
                                                            }
                                                        >
                                                            <ItemContent>
                                                                <ItemTitle>
                                                                    {item.goal}
                                                                </ItemTitle>
                                                            </ItemContent>
                                                            <Badge>
                                                                {
                                                                    PACK_STATUS[
                                                                        item
                                                                            .status
                                                                    ]
                                                                }
                                                            </Badge>
                                                            <time
                                                                dateTime={
                                                                    item.createdAt
                                                                }
                                                                className="type-caption text-text-3"
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
                                                        </Item>
                                                    ))}
                                            </ItemGroup>
                                        </div>
                                    ) : lastPackHref ? (
                                        <div className="border-t border-line-faint pt-5">
                                            <h3 className="type-label text-text-2">
                                                Last Scout workspace
                                            </h3>
                                            <Link
                                                to="/workspace/$id"
                                                params={{ id: lastPackHref }}
                                                className="mt-2 inline-flex items-center gap-2 type-body-sm text-text-1 underline-offset-4 hover:underline"
                                            >
                                                {lastPackTitle ??
                                                    "Open workspace"}{" "}
                                                <Icon
                                                    icon={ArrowRight}
                                                    className="text-text-3"
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
                                    className="flex flex-col gap-5"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon
                                            icon={Pending}
                                            className="animate-spin text-text-2"
                                        />
                                        <h2
                                            id="scout-running-heading"
                                            className="type-heading-sm"
                                        >
                                            {pack.status === "building"
                                                ? "Building your roadmap"
                                                : "Finding your resources"}
                                        </h2>
                                    </div>
                                    <p className="type-body-sm text-text-2">
                                        {pack.stage}
                                    </p>

                                    <Progress
                                        value={Math.max(
                                            4,
                                            Math.min(100, pack.progress),
                                        )}
                                        aria-label="Scout progress"
                                    />

                                    <p className="type-caption text-text-2">
                                        You can close this tab. Scout keeps
                                        working on the server; come back to
                                        approve the picks.
                                    </p>

                                    {pack.resources.length > 0 ? (
                                        <div>
                                            <h3 className="type-label text-text-2">
                                                Found so far
                                            </h3>
                                            <ul className="mt-2 flex flex-col">
                                                {pack.resources
                                                    .slice(0, 8)
                                                    .map((resource) => (
                                                        <li
                                                            key={resource.id}
                                                            className="rule-row flex items-baseline justify-between gap-4 py-2 type-body-sm"
                                                        >
                                                            <span className="truncate text-text-2">
                                                                {resource.title}
                                                            </span>
                                                            <span className="shrink-0 type-caption text-text-3">
                                                                {resource.kind}
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </section>
                            ) : null}
                            </div>
                        </div>
                    </div>

                            {pack?.status === "review" ? (
                                <section
                                    className="shell"
                                    aria-labelledby="scout-review-heading"
                                >
                                    <div className="panel flex flex-col gap-5 p-3">
                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                        <div>
                                            <h2
                                                id="scout-review-heading"
                                                className="type-heading-sm"
                                            >
                                                Keep the picks worth your time
                                            </h2>
                                            <p className="mt-1 type-body-sm text-text-2">
                                                {picks.length} found ·{" "}
                                                {selected.size} kept
                                                {selectedMinutes > 0
                                                    ? ` · ~${humanDuration(selectedMinutes * 60)} of video`
                                                    : ""}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
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
                                        <Alert status="warn">
                                            {failedResources} resource
                                            {failedResources === 1 ? "" : "s"}{" "}
                                            could not be read and will be
                                            skipped.
                                        </Alert>
                                    ) : null}

                                    <PickList
                                        resources={picks}
                                        selected={selected}
                                        onToggle={togglePick}
                                    />

                                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-faint pt-5">
                                        <p className="type-caption text-text-2">
                                            Roadmap and review cards are built
                                            only from the picks you keep.
                                        </p>
                                        <Button
                                            pending={approving}
                                            onClick={() => void approve()}
                                            disabled={
                                                approving ||
                                                selected.size === 0
                                            }
                                        >
                                            {approving
                                                ? "Building"
                                                : `Keep ${selected.size} and build`}
                                        </Button>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="self-start"
                                        onClick={reset}
                                    >
                                        Start over with a different goal
                                    </Button>
                                    </div>
                                </section>
                            ) : null}

                            {pack?.status === "ready" ? (
                                <section
                                    className="shell"
                                    aria-labelledby="scout-ready-heading"
                                >
                                    <div className="panel flex flex-col gap-4 p-3">
                                    <h2
                                        id="scout-ready-heading"
                                        className="type-heading-sm"
                                    >
                                        Review your roadmap draft
                                    </h2>
                                    <p className="type-body-sm text-text-2">
                                        Change the title or task wording before
                                        keeping this plan. You can edit its
                                        full structure afterward.
                                    </p>
                                    {draftRoadmap && (
                                        <div className="flex flex-col gap-4">
                                            <Field>
                                                <FieldLabel>
                                                    Roadmap title
                                                </FieldLabel>
                                                <Input
                                                    value={draftRoadmap.title}
                                                    onValueChange={(title) =>
                                                        setDraftRoadmap({
                                                            ...draftRoadmap,
                                                            title,
                                                        })
                                                    }
                                                />
                                            </Field>
                                            <p className="type-caption text-text-2">
                                                {draftRoadmap.summary}
                                            </p>
                                            {draftGroups.map((group) => (
                                                <section key={group.key}>
                                                    <h3 className="type-label text-text-2">
                                                        {group.heading}
                                                    </h3>
                                                    {group.sections.map(
                                                        (section) => (
                                                            <div
                                                                className="mt-2 flex flex-col gap-3"
                                                                key={section.id}
                                                            >
                                                                <p className="type-caption text-text-2">
                                                                    {
                                                                        section.title
                                                                    }
                                                                </p>
                                                                {section.data.tasks.map(
                                                                    (task) => (
                                                                        <Field
                                                                            key={
                                                                                task.id
                                                                            }
                                                                        >
                                                                            <FieldLabel>
                                                                                <span className="flex items-center gap-2">
                                                                                    Task
                                                                                    <Badge>
                                                                                        {group.key ===
                                                                                        "reading"
                                                                                            ? "Reading"
                                                                                            : task.core
                                                                                              ? "Core"
                                                                                              : "Go deeper"}
                                                                                    </Badge>
                                                                                </span>
                                                                            </FieldLabel>
                                                                            <Input
                                                                                value={
                                                                                    task.title
                                                                                }
                                                                                onValueChange={(
                                                                                    title,
                                                                                ) =>
                                                                                    renameDraftTask(
                                                                                        section.id,
                                                                                        task.id,
                                                                                        title,
                                                                                    )
                                                                                }
                                                                            />
                                                                            {task.core &&
                                                                            task.coreReason ? (
                                                                                <p className="type-caption text-text-2">
                                                                                    {
                                                                                        task.coreReason
                                                                                    }
                                                                                </p>
                                                                            ) : null}
                                                                        </Field>
                                                                    ),
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </section>
                                            ))}
                                            <div>
                                                <Button
                                                    disabled={
                                                        !draftRoadmap.title.trim()
                                                    }
                                                    onClick={() => {
                                                        if (
                                                            !pack ||
                                                            !draftRoadmap
                                                        )
                                                            return;
                                                        const id =
                                                            publishScoutPack({
                                                                ...pack,
                                                                roadmap:
                                                                    draftRoadmap,
                                                            });
                                                        if (id)
                                                            void navigate({
                                                                to: "/learn",
                                                                search: {
                                                                    roadmap: id,
                                                                },
                                                            });
                                                    }}
                                                >
                                                    Keep roadmap and start
                                                    learning
                                                    <Icon icon={ArrowRight} />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                </section>
                            ) : null}

                            {pack?.status === "failed" ? (
                                <section
                                    className="shell"
                                    aria-labelledby="scout-failed-heading"
                                >
                                    <div className="panel flex flex-col gap-4 p-3">
                                    <h2
                                        id="scout-failed-heading"
                                        className="type-heading-sm"
                                    >
                                        Scout could not finish that pack
                                    </h2>
                                    <p className="type-body-sm text-text-2">
                                        {pack.error ??
                                            "The run stopped early. Your library and settings are unchanged."}
                                    </p>
                                    <div>
                                        <Button
                                            variant="secondary"
                                            onClick={reset}
                                        >
                                            Try another goal
                                        </Button>
                                    </div>
                                    </div>
                                </section>
                            ) : null}

                            {error ? (
                                <Alert status="fail">{error}</Alert>
                            ) : null}

                            {pack && pack.costCents > 0 ? (
                                <p className="type-caption text-text-2">
                                    This pack has used an estimated{" "}
                                    <span className="text-text-1">
                                        ${(pack.costCents / 100).toFixed(4)}
                                    </span>{" "}
                                    so far.
                                </p>
                            ) : null}
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
        </PageFrame>
    );
}
