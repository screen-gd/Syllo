import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { Link } from "@tanstack/react-router";
import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    External,
    Icon,
    Add,
    TrashCan,
} from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/glaze/ui/item";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { Skeleton, SkeletonText } from "@/components/glaze/ui/skeleton";
import { Switch } from "@/components/glaze/ui/switch";
import { Textarea } from "@/components/glaze/ui/textarea";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";
import {
    getLadder,
    levelUpReady,
    LEVEL_LABEL,
    nextCoreItem,
    type LadderItem,
    type LadderLevel,
} from "@/lib/ladder";
import {
    getLearningTasks,
    learningVideo,
    nextLearningTask,
    safeResourceUrl,
    setLearningSubtaskDone,
    setLearningTaskDone,
    taskVideo,
} from "@/lib/learning";
import type { LearningLevel, Roadmap } from "@/types";
import { getVideoStartSeconds } from "@/lib/video-utils";
import { formatTimestamp, parseTimestamp } from "@/lib/scout/format";
import {
    getPersonalSnapshot,
    personalEntries,
    putPersonalEntry,
    removePersonalEntry,
    usePersonalData,
} from "@/lib/personal/store";
import StudyVideo from "@/components/learning/StudyVideo";
import { Pomodoro, useStudyFocus } from "@/components/learning/Pomodoro";
import type { StudyFocus } from "@/lib/screen-time/client";
import ReviewComposer from "@/components/learning/ReviewComposer";
import TermComposer from "@/components/learning/TermComposer";
import {
    RecallPrompt,
    useVideoChecks,
    VideoChecksStatus,
} from "@/components/learning/RecallCheck";
import type { VideoChapterInput } from "@/lib/scout/types";

type TabKey = "read" | "check" | "apply";
const RECALL_PAUSES_KEY = "syllo:recall-pauses";

/** Scout writes durations as "12 min"; manual videos may use "mm:ss". */
function durationSeconds(value: string | undefined): number | null {
    if (!value) return null;
    const minutes = value.match(/^(\d+(?:\.\d+)?)\s*min/i);
    if (minutes) return Number(minutes[1]) * 60;
    return parseTimestamp(value);
}

function readRecallPauses() {
    try {
        return localStorage.getItem(RECALL_PAUSES_KEY) !== "off";
    } catch {
        return true;
    }
}

export default function LearnPage({
    roadmapId,
    taskId,
    targetSeconds,
}: {
    roadmapId?: string;
    taskId?: string;
    targetSeconds?: number;
}) {
    const { roadmaps, loaded } = useLearningRoadmaps();
    const records = usePersonalData();
    const roadmap =
        roadmaps.find((item) => item.id === roadmapId) ??
        (!roadmapId ? roadmaps[0] : null);
    const tasks = useMemo(
        () => (roadmap ? getLearningTasks(roadmap) : []),
        [roadmap],
    );
    const ladder = useMemo(
        () => (roadmap ? getLadder(roadmap) : null),
        [roadmap],
    );
    const candidate =
        tasks.find((entry) => entry.task.id === taskId) ??
        (roadmap && ladder
            ? (nextCoreItem(roadmap) ??
              ladder.levels[0]?.items[0] ??
              ladder.reading[0] ??
              nextLearningTask(roadmap) ??
              tasks[0])
            : null);
    // Keep the open lesson steady when completion updates the roadmap.
    const openTaskId = useRef<string | null>(null);
    if (openTaskId.current === null)
        openTaskId.current = candidate?.task.id ?? null;
    const item =
        tasks.find((entry) => entry.task.id === openTaskId.current) ??
        candidate;
    const openInfo = useMemo(() => {
        if (!ladder || !item) return null;
        for (const level of ladder.levels) {
            const found = level.items.find(
                (entry) => entry.task.id === item.task.id,
            );
            if (found) {
                return {
                    item: found,
                    level,
                    coreIndex: level.core.findIndex(
                        (entry) => entry.task.id === found.task.id,
                    ),
                };
            }
        }
        const readingItem = ladder.reading.find(
            (entry) => entry.task.id === item.task.id,
        );
        return readingItem ? { item: readingItem, level: null, coreIndex: -1 } : null;
    }, [ladder, item]);
    const videoResource = item ? taskVideo(item) : null;
    const video = useMemo(
        () => (roadmap && videoResource ? learningVideo(roadmap, videoResource.url) : null),
        [roadmap, videoResource],
    );
    const chapterInput = useMemo<VideoChapterInput[]>(
        () =>
            (video?.timestamps ?? []).flatMap((stamp) => {
                const seconds = parseTimestamp(stamp.time);
                return seconds === null
                    ? []
                    : [{ seconds, label: stamp.label || stamp.time }];
            }),
        [video],
    );
    const videoChecks = useVideoChecks({
        url: videoResource?.url ?? null,
        title: video?.title || videoResource?.title || "",
        chapters: chapterInput,
        durationSeconds: durationSeconds(video?.duration),
    });
    const checks =
        videoChecks.state.kind === "ready" ? videoChecks.state.checks : [];
    const activeUrl =
        videoResource?.url ?? item?.resources[0]?.url ?? "";
    const activeId = item?.task.id;
    const activeRoadmap = roadmap?.id;
    const practiceId =
        activeRoadmap && activeId
            ? `annotation:practice:${activeRoadmap}:${activeId}`
            : "";
    const studyId =
        activeRoadmap && activeId ? `study:${activeRoadmap}:${activeId}` : "";

    const [draft, setDraft] = useState("");
    const [tab, setTab] = useState<TabKey>("read");
    const [seekTo, setSeekTo] = useState<number | null>(null);
    const [position, setPosition] = useState(0);
    const positionRef = useRef(0);
    const [manualPosition, setManualPosition] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [practice, setPractice] = useState("");
    const [levelOverrides, setLevelOverrides] = useState<Map<LearningLevel, boolean>>(
        () => new Map(),
    );
    const [readingOpen, setReadingOpen] = useState(false);
    const [completion, setCompletion] = useState<{
        taskId: string;
        roadmap: Roadmap;
        core: boolean;
    } | null>(null);
    const [recallText, setRecallText] = useState("");
    const [recallResolved, setRecallResolved] = useState(false);
    // Recall questions answered or skipped in this visit, and the one the
    // video is paused on.
    const [answeredChecks, setAnsweredChecks] = useState<Set<string>>(
        () => new Set(),
    );
    const [pausedCheckId, setPausedCheckId] = useState<string | null>(null);
    const [playSignal, setPlaySignal] = useState(0);
    const [recallPauses, setRecallPauses] = useState(true);
    const uid = useId().replace(/:/g, "");

    // The Pomodoro provider uses this to name the Screen Time session and to
    // keep the lesson's links reachable while blocking runs.
    const studyFocus = useMemo<StudyFocus | null>(() => {
        if (!item) return null;
        const title = item.task.title || item.task.text;
        const goal = [title, item.sectionTitle].filter(Boolean).join(" · ");
        const resourceUrls = [
            ...item.resources.map((resource) => resource.url),
            ...(videoResource ? [videoResource.url] : []),
        ].flatMap((value) => {
            const safe = safeResourceUrl(value);
            return safe ? [safe] : [];
        });
        return { goal, resourceUrls };
    }, [item, videoResource]);
    useStudyFocus(studyFocus);

    useEffect(() => {
        if (!activeId || !activeRoadmap) return;
        const stored = getPersonalSnapshot()[`study:${activeRoadmap}:${activeId}`];
        const seconds =
            targetSeconds ??
            (stored?.kind === "study" && stored.data.resourceUrl === activeUrl
                ? stored.data.seconds
                : getVideoStartSeconds(activeUrl));
        positionRef.current = seconds;
        setPosition(seconds);
        setSeekTo(null);
        setDraft("");
        setError(null);
        setTab("read");
        setCompletion(null);
        setRecallText("");
        setRecallResolved(false);
        setAnsweredChecks(new Set());
        setPausedCheckId(null);
        setRecallPauses(readRecallPauses());
        const savedPractice = practiceId
            ? getPersonalSnapshot()[practiceId]
            : undefined;
        setPractice(
            savedPractice?.kind === "annotation"
                ? savedPractice.data.text
                : "",
        );
        try {
            putPersonalEntry({
                kind: "study",
                id: `study:${activeRoadmap}:${activeId}`,
                updatedAt: Date.now(),
                deleted: false,
                data: {
                    roadmapId: activeRoadmap,
                    taskId: activeId,
                    resourceUrl: activeUrl,
                    seconds,
                    lastOpenedAt: new Date().toISOString(),
                },
            });
        } catch {
            setError(
                "Your playback position could not be saved. Free some browser storage and try again.",
            );
        }
    }, [activeId, activeRoadmap, activeUrl, targetSeconds, practiceId]);

    function recordPosition(seconds: number) {
        if (!activeRoadmap || !activeId) return;
        positionRef.current = seconds;
        setPosition(seconds);
        try {
            putPersonalEntry({
                kind: "study",
                id: `study:${activeRoadmap}:${activeId}`,
                updatedAt: Date.now(),
                deleted: false,
                data: {
                    roadmapId: activeRoadmap,
                    taskId: activeId,
                    resourceUrl: activeUrl,
                    seconds,
                    lastOpenedAt: new Date().toISOString(),
                },
            });
        } catch {
            setError(
                "Your playback position could not be saved. Free some browser storage and try again.",
            );
        }
    }

    function seek(seconds: number) {
        const safe = Math.max(0, seconds);
        recordPosition(safe);
        setSeekTo(null);
        requestAnimationFrame(() => setSeekTo(safe));
    }

    function finishCheck(id: string) {
        setAnsweredChecks((current) => new Set(current).add(id));
    }

    function resumeAfterCheck(id: string) {
        finishCheck(id);
        setPausedCheckId(null);
        setPlaySignal((value) => value + 1);
    }

    function toggleRecallPauses(on: boolean) {
        setRecallPauses(on);
        try {
            localStorage.setItem(RECALL_PAUSES_KEY, on ? "on" : "off");
        } catch {
            // The choice still holds for this visit.
        }
    }

    function saveNote() {
        if (!draft.trim() || !roadmap || !item) return;
        try {
            putPersonalEntry({
                kind: "annotation",
                id: `annotation:${crypto.randomUUID()}`,
                updatedAt: Date.now(),
                deleted: false,
                data: {
                    text: draft.trim(),
                    quote: "",
                    color: "#8fb0e6",
                    createdAt: new Date().toISOString(),
                    anchor: {
                        kind: "lesson",
                        roadmapId: roadmap.id,
                        taskId: item.task.id,
                        url: activeUrl,
                        seconds: positionRef.current,
                    },
                },
            });
            setDraft("");
            setError(null);
        } catch {
            setError(
                "Your note could not be saved. Free some browser storage and try again.",
            );
        }
    }

    function savePractice() {
        if (!practice.trim() || !roadmap || !item || !practiceId) return;
        try {
            putPersonalEntry({
                kind: "annotation",
                id: practiceId,
                updatedAt: Date.now(),
                deleted: false,
                data: {
                    text: practice.trim(),
                    quote: "",
                    color: "#8fb0e6",
                    createdAt: new Date().toISOString(),
                    anchor: {
                        kind: "lesson",
                        roadmapId: roadmap.id,
                        taskId: item.task.id,
                        url: activeUrl,
                        seconds: 0,
                    },
                },
            });
            setError(null);
        } catch {
            setError(
                "Your practice note could not be saved. Free some browser storage and try again.",
            );
        }
    }

    function saveRecall() {
        if (!recallText.trim() || !roadmap || !item) return;
        try {
            putPersonalEntry({
                kind: "annotation",
                id: `annotation:recall:${roadmap.id}:${item.task.id}`,
                updatedAt: Date.now(),
                deleted: false,
                data: {
                    text: recallText.trim(),
                    quote: "",
                    color: "#8fb0e6",
                    createdAt: new Date().toISOString(),
                    anchor: {
                        kind: "lesson",
                        roadmapId: roadmap.id,
                        taskId: item.task.id,
                        url: activeUrl,
                        seconds: positionRef.current,
                    },
                },
            });
            setRecallResolved(true);
            setError(null);
        } catch {
            setError(
                "Your note could not be saved. Free some browser storage and try again.",
            );
        }
    }

    function onMarkDone(checked: boolean) {
        if (!roadmap || !item) return;
        let updated: Roadmap;
        try {
            updated = setLearningTaskDone(roadmap, item.task.id, checked);
        } catch {
            setError(
                "This lesson could not be saved. Free some browser storage and try again.",
            );
            return;
        }
        setError(null);
        if (!checked) {
            setCompletion(null);
            return;
        }
        setRecallText("");
        setRecallResolved(false);
        setCompletion({
            taskId: item.task.id,
            roadmap: updated,
            core: openInfo?.item.role === "core",
        });
    }

    if (!loaded)
        return (
            <div
                className="flex flex-col gap-4"
                role="status"
                aria-label="Loading"
            >
                <span className="sr-only">Loading</span>
                <SkeletonText type="body" last={0.3} />
                <div className="grid gap-4 lg:grid-cols-5">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <section className="shell">
                            <div className="panel p-4">
                                <SkeletonText type="body-sm" last={0.34} />
                                <Skeleton className="mt-3 h-44 w-full rounded-panel" />
                                <div className="mt-3">
                                    <SkeletonText type="body-sm" last={0.6} />
                                </div>
                            </div>
                        </section>
                        <section className="shell">
                            <div className="panel p-4">
                                <SkeletonText type="body-sm" last={0.24} />
                                <div className="mt-3">
                                    <SkeletonText type="body" last={0.9} />
                                    <SkeletonText type="body-sm" last={0.7} />
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="lg:col-span-3">
                        <section className="shell">
                            <div className="panel p-4">
                                <SkeletonText type="heading" last={0.45} />
                                <div className="mt-4">
                                    <SkeletonText type="body" last={0.92} />
                                    <SkeletonText type="body" last={0.84} />
                                    <SkeletonText type="body" last={0.58} />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    if (!roadmap)
        return (
            <div className="flex flex-col gap-4">
                <Empty reason="empty">
                    <EmptyHeader>
                        <EmptyTitle>
                            {roadmapId
                                ? "This learning topic is not on this device"
                                : "Start a learning topic"}
                        </EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                        <p className="type-body-sm text-text-2">
                            {roadmapId
                                ? "It may have been deleted here, or it only exists on another device."
                                : "Start with a goal, or organize resources you already have."}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <Button
                                render={<Link to="/scout" />}
                                nativeButton={false}
                            >
                                Open Scout
                                <Icon icon={ArrowRight} />
                            </Button>
                            <Button
                                variant="secondary"
                                render={<Link to="/create" />}
                                nativeButton={false}
                            >
                                Add your own roadmap
                            </Button>
                        </div>
                    </EmptyContent>
                </Empty>
            </div>
        );
    if (!item)
        return (
            <div className="flex flex-col gap-4">
                <Empty reason="empty">
                    <EmptyHeader>
                        <EmptyTitle>
                            This roadmap has no lessons yet
                        </EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                        <p className="type-body-sm text-text-2">
                            Open its workspace to add tasks and resources, or
                            explore what it already holds.
                        </p>
                        <Button
                            className="mt-3"
                            render={
                                <Link
                                    to="/workspace/$id"
                                    params={{ id: roadmap.id }}
                                />
                            }
                            nativeButton={false}
                        >
                            Open full workspace
                            <Icon icon={ArrowRight} />
                        </Button>
                    </EmptyContent>
                </Empty>
            </div>
        );

    const index = tasks.findIndex(
        (entry) => entry.task.id === item.task.id,
    );
    const title = item.task.title || item.task.text || "Untitled lesson";
    const done = item.task.completed || !!item.task.done;
    const next = nextCoreItem(roadmap, { excludeTaskId: item.task.id });
    const metaLabel = openInfo
        ? openInfo.level === null
            ? "Reading track"
            : openInfo.item.role === "core"
              ? `${LEVEL_LABEL[openInfo.level.level]} · core ${openInfo.coreIndex + 1} of ${openInfo.level.coreTotal}`
              : `${LEVEL_LABEL[openInfo.level.level]} · go deeper`
        : `Lesson ${index + 1} of ${tasks.length}`;
    const ladderLevelUp = ladder ? levelUpReady(ladder) : null;
    const ladderLevelUpTarget = nextCoreItem(roadmap);
    const openLevels = new Set<LearningLevel>();
    if (ladder?.current) openLevels.add(ladder.current);
    if (openInfo?.level) openLevels.add(openInfo.level.level);
    const isLevelOpen = (level: LearningLevel) =>
        levelOverrides.get(level) ?? openLevels.has(level);
    const toggleLevel = (level: LearningLevel) =>
        setLevelOverrides(
            (current) => new Map(current).set(level, !isLevelOpen(level)),
        );
    const completionOpen = completion !== null && completion.taskId === item.task.id;
    const completionLadder =
        completionOpen && completion ? getLadder(completion.roadmap) : null;
    const completionLevelUp = completionLadder
        ? levelUpReady(completionLadder)
        : null;
    const completionNext = completion
        ? nextCoreItem(completion.roadmap, { excludeTaskId: completion.taskId })
        : null;
    const completionLevelUpTarget = completion
        ? nextCoreItem(completion.roadmap)
        : null;

    const lessonRow = (entry: LadderItem, position: number) => {
        const current = entry.task.id === item.task.id;
        return (
            <Item
                key={entry.task.id}
                size="sm"
                selected={current}
                aria-current={current ? "step" : undefined}
                render={
                    <Link
                        to="/learn"
                        search={{
                            roadmap: roadmap.id,
                            task: entry.task.id,
                        }}
                    />
                }
            >
                <span className="type-caption text-text-3">
                    {String(position + 1).padStart(2, "0")}
                </span>
                <ItemContent>
                    <ItemTitle>
                        {entry.task.title || entry.task.text || "Untitled lesson"}
                    </ItemTitle>
                    {entry.role === "core" && entry.task.coreReason ? (
                        <ItemDescription>
                            {entry.task.coreReason}
                        </ItemDescription>
                    ) : null}
                </ItemContent>
                {entry.done ? <Icon icon={Check} /> : null}
            </Item>
        );
    };

    const levelSection = (level: LadderLevel) => {
        const open = isLevelOpen(level.level);
        const regionId = `${uid}-level-${level.level}`;
        return (
            <div key={level.level}>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    aria-expanded={open}
                    aria-controls={regionId}
                    onClick={() => toggleLevel(level.level)}
                >
                    <Icon
                        icon={open ? ChevronDown : ChevronRight}
                        className="text-text-3"
                    />
                    <span className="min-w-0 flex-1 truncate text-start">
                        {LEVEL_LABEL[level.level]}
                    </span>
                    <span className="type-caption text-text-2">
                        {level.coreDone}/{level.coreTotal} core
                    </span>
                    {level.complete ? (
                        <Badge>Done</Badge>
                    ) : level.level === ladder?.current ? (
                        <Badge>Up next</Badge>
                    ) : null}
                </Button>
                {open ? (
                    <ItemGroup
                        id={regionId}
                        variant="plain"
                        className="mt-1"
                    >
                        {level.core.map((entry, position) =>
                            lessonRow(entry, position),
                        )}
                        {level.deeper.length > 0 && (
                            <p className="px-3 pt-2 pb-1 type-caption text-text-3">
                                Go deeper (optional)
                            </p>
                        )}
                        {level.deeper.map((entry, position) =>
                            lessonRow(entry, position),
                        )}
                    </ItemGroup>
                ) : null}
            </div>
        );
    };
    const practiceEntry = practiceId ? records[practiceId] : undefined;
    const practiceSaved =
        practiceEntry?.kind === "annotation" &&
        practiceEntry.data.text === practice.trim() &&
        practice.trim() !== "";
    const subtasks = item.task.subtasks;
    const doneSubtasks = subtasks.filter((subtask) => subtask.completed).length;
    const section = roadmap.sections.find(
        (entry) => entry.id === item.sectionId,
    );
    const moduleData = section?.type === "module" ? section.data : null;
    const milestone =
        section?.type === "milestones"
            ? section.data.find((entry) => entry.title === item.sectionTitle)
            : undefined;
    const contextDescription =
        moduleData?.description || milestone?.description || "";
    const objectives = moduleData?.objectives ?? [];
    const concepts = moduleData?.concepts ?? "";
    const sectionNotes = moduleData?.notes ?? "";
    const brief = item.task.description || item.task.text || "";
    const savedStudy = studyId ? records[studyId] : undefined;
    const startSeconds =
        targetSeconds ??
        (savedStudy?.kind === "study" &&
        savedStudy.data.resourceUrl === activeUrl
            ? savedStudy.data.seconds
            : getVideoStartSeconds(activeUrl));
    const externalSource = safeResourceUrl(activeUrl);
    const external =
        externalSource && video ? new URL(externalSource) : null;
    if (external) external.searchParams.set("t", `${Math.floor(position)}s`);
    const chapters = (video?.timestamps ?? []).flatMap((stamp) => {
        const seconds = parseTimestamp(stamp.time);
        return seconds === null
            ? []
            : [
                  {
                      seconds,
                      label: stamp.label || stamp.time,
                      time: stamp.time,
                  },
              ];
    });
    const activeChapter = chapters.reduce<number | null>(
        (current, chapter) =>
            position + 0.5 >= chapter.seconds ? chapter.seconds : current,
        null,
    );
    const pendingChecks = checks.filter(
        (check) => !answeredChecks.has(check.id),
    );
    const checkpoints = recallPauses
        ? pendingChecks.flatMap((check) =>
              check.pauseAt === null ? [] : [check.pauseAt],
          )
        : [];
    const pausedCheck =
        checks.find((check) => check.id === pausedCheckId) ?? null;
    const nextCheck = pendingChecks[0] ?? null;
    const answeredList = checks.filter((check) =>
        answeredChecks.has(check.id),
    );
    const hasChapterChecks = checks.some((check) => check.pauseAt !== null);
    const notes = personalEntries(records, "annotation")
        .flatMap((entry) => {
            const anchor = entry.data.anchor;
            if (anchor.kind !== "lesson") return [];
            if (
                anchor.roadmapId !== roadmap.id ||
                anchor.taskId !== item.task.id
            )
                return [];
            if (entry.id.startsWith("annotation:practice:")) return [];
            return [
                {
                    id: entry.id,
                    text: entry.data.text,
                    seconds: anchor.seconds,
                    updatedAt: entry.updatedAt,
                },
            ];
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    const sources = item.resources.filter(
        (resource) => safeResourceUrl(resource.url) !== null,
    );

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <nav
                    className="flex min-w-0 items-baseline gap-2 type-caption text-text-2"
                    aria-label="Breadcrumb"
                >
                    <Link to="/workspaces" className="hover:text-text-1">
                        Learning topics
                    </Link>
                    <span aria-hidden="true">/</span>
                    <span className="truncate">{roadmap.title}</span>
                    <span aria-hidden="true">/</span>
                    <b className="truncate text-text-1">{title}</b>
                </nav>
                <div className="flex items-center gap-2">
                    <span className="type-caption text-text-2">{metaLabel}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        title="Edit roadmap"
                        render={
                            <Link
                                to="/workspace/$id"
                                params={{ id: roadmap.id }}
                            />
                        }
                        nativeButton={false}
                    >
                        Edit roadmap
                        <Icon icon={External} />
                    </Button>
                </div>
            </header>

            {error && <Alert status="fail">{error}</Alert>}

            <div className="grid gap-4 lg:grid-cols-5">
                <aside
                    className="flex min-w-0 flex-col gap-4 lg:col-span-2"
                    aria-label="Video and notes"
                >
                    <section className="shell">
                        <div className="panel">
                            <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                <span className="type-caption text-text-2">
                                    {videoResource
                                        ? "Watch the walkthrough"
                                        : "Lesson source"}
                                </span>
                                {video?.duration && (
                                    <span className="type-caption text-text-2">
                                        {video.duration}
                                    </span>
                                )}
                            </header>
                            <div className="px-4">
                                {videoResource ? (
                                    <StudyVideo
                                        key={`${item.task.id}:${videoResource.url}`}
                                        url={videoResource.url}
                                        title={
                                            video?.title || videoResource.title
                                        }
                                        startSeconds={startSeconds}
                                        seekTo={seekTo}
                                        onPosition={recordPosition}
                                        checkpoints={checkpoints}
                                        onCheckpoint={(seconds) => {
                                            const due = pendingChecks.find(
                                                (check) =>
                                                    check.pauseAt === seconds,
                                            );
                                            if (due) setPausedCheckId(due.id);
                                        }}
                                        playSignal={playSignal}
                                    />
                                ) : (
                                    <Empty variant="plain" reason="empty">
                                        <EmptyHeader>
                                            <EmptyTitle>
                                                This lesson is reading only.
                                                Open a source from the Read tab.
                                            </EmptyTitle>
                                        </EmptyHeader>
                                    </Empty>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-3 p-4 pt-3">
                                <div className="min-w-0">
                                    <p className="truncate type-body-sm text-text-1">
                                        {video?.title ||
                                            videoResource?.title ||
                                            title}
                                    </p>
                                    {videoResource && (
                                        <p className="type-caption text-text-3">
                                            Saved at {formatTimestamp(position)}
                                        </p>
                                    )}
                                </div>
                                {external && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        render={
                                            <a
                                                href={external.toString()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            />
                                        }
                                        nativeButton={false}
                                    >
                                        External
                                        <Icon icon={External} />
                                    </Button>
                                )}
                            </div>
                            {pausedCheck && (
                                <div className="px-4 pb-4">
                                    <RecallPrompt
                                        check={pausedCheck}
                                        eyebrow={`Quick check · ${pausedCheck.label}`}
                                        autoFocus
                                        doneLabel="Continue watching"
                                        onDone={() =>
                                            resumeAfterCheck(pausedCheck.id)
                                        }
                                        onSkip={() =>
                                            resumeAfterCheck(pausedCheck.id)
                                        }
                                        onReplay={(seconds) => {
                                            finishCheck(pausedCheck.id);
                                            setPausedCheckId(null);
                                            seek(seconds);
                                            setPlaySignal((value) => value + 1);
                                        }}
                                    />
                                </div>
                            )}
                            {hasChapterChecks && (
                                <div className="px-4 pb-4">
                                    <Field orientation="horizontal">
                                        <FieldLabel className="flex-1">
                                            Pause for one question at the end
                                            of each chapter
                                        </FieldLabel>
                                        <Switch
                                            checked={recallPauses}
                                            onCheckedChange={
                                                toggleRecallPauses
                                            }
                                        />
                                    </Field>
                                </div>
                            )}
                            {videoResource && (
                                <details className="px-4 pb-4">
                                    <summary className="cursor-pointer type-caption text-text-2">
                                        Update position after listening
                                        elsewhere
                                    </summary>
                                    <div className="mt-2 flex items-end gap-2">
                                        <Field className="w-32">
                                            <FieldLabel>Minutes</FieldLabel>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                value={manualPosition}
                                                onChange={(event) =>
                                                    setManualPosition(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled={manualPosition === ""}
                                            onClick={() => {
                                                const minutes = Number(
                                                    manualPosition,
                                                );
                                                if (!Number.isFinite(minutes))
                                                    return;
                                                setManualPosition("");
                                                seek(Math.max(0, minutes * 60));
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </details>
                            )}
                        </div>
                    </section>

                    {chapters.length > 0 && (
                        <section className="shell">
                            <div className="panel">
                                <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                    <h2 className="type-heading-sm">
                                        Chapters
                                    </h2>
                                    <span className="type-caption text-text-2">
                                        {chapters.length}
                                    </span>
                                </header>
                                <ItemGroup variant="plain" className="px-2 pb-2">
                                    {chapters.map((chapter) => (
                                        <Button
                                            key={`${chapter.seconds}:${chapter.label}`}
                                            variant="ghost"
                                            size="sm"
                                            aria-current={
                                                activeChapter ===
                                                chapter.seconds
                                                    ? "true"
                                                    : undefined
                                            }
                                            className="w-full justify-start"
                                            onClick={() =>
                                                seek(chapter.seconds)
                                            }
                                        >
                                            <span className="type-caption text-text-3">
                                                {chapter.time}
                                            </span>
                                            <span
                                                className={
                                                    activeChapter ===
                                                    chapter.seconds
                                                        ? "min-w-0 flex-1 truncate text-start"
                                                        : "min-w-0 flex-1 truncate text-start text-text-2"
                                                }
                                            >
                                                {chapter.label}
                                            </span>
                                        </Button>
                                    ))}
                                </ItemGroup>
                            </div>
                        </section>
                    )}

                    <section className="shell">
                        <div className="panel">
                            <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                <h2 className="type-heading-sm">Notes</h2>
                                <span className="type-caption text-text-2">
                                    at {formatTimestamp(position)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    render={
                                        <Link
                                            to="/notes"
                                            search={{ roadmap: roadmap.id }}
                                        />
                                    }
                                    nativeButton={false}
                                >
                                    All notes
                                </Button>
                            </header>
                            <form
                                className="flex items-start gap-2 px-4 pb-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    saveNote();
                                }}
                            >
                                <Textarea
                                    className="min-w-0 flex-1"
                                    value={draft}
                                    onValueChange={setDraft}
                                    placeholder="A thought, a question"
                                    aria-label="New note"
                                    autoGrow
                                    minRows={1}
                                    maxRows={6}
                                />
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    size="icon-sm"
                                    aria-label="Save note"
                                    disabled={!draft.trim()}
                                >
                                    <Icon icon={Add} />
                                </Button>
                            </form>
                            {pausedCheck ? (
                                <p className="px-4 pb-4 type-caption text-text-3">
                                    Notes are hidden while you answer.
                                </p>
                            ) : notes.length === 0 ? (
                                <p className="px-4 pb-4 type-caption text-text-3">
                                    No notes yet. They attach to{" "}
                                    {formatTimestamp(position)}.
                                </p>
                            ) : (
                                <ul className="px-4 pb-4">
                                    {notes.map((note) => (
                                        <li
                                            key={note.id}
                                            className="flex items-baseline gap-2 py-1"
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    seek(note.seconds)
                                                }
                                            >
                                                {formatTimestamp(note.seconds)}
                                            </Button>
                                            <p className="min-w-0 flex-1 type-body-sm">
                                                {note.text}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Delete note"
                                                onClick={() =>
                                                    removePersonalEntry(
                                                        note.id,
                                                    )
                                                }
                                            >
                                                <Icon icon={TrashCan} />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    <section className="shell">
                        <div className="panel">
                            <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                <h2 className="type-heading-sm">Ladder</h2>
                                <span className="type-caption text-text-2">
                                    {ladder
                                        ? `${ladder.levels.reduce((total, level) => total + level.coreDone, 0)}/${ladder.levels.reduce((total, level) => total + level.coreTotal, 0)} core`
                                        : "0/0 core"}
                                </span>
                            </header>
                            {ladderLevelUp && ladderLevelUpTarget ? (
                                <div className="px-4 pb-3">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        render={
                                            <Link
                                                to="/learn"
                                                search={{
                                                    roadmap: roadmap.id,
                                                    task: ladderLevelUpTarget
                                                        .task.id,
                                                }}
                                            />
                                        }
                                        nativeButton={false}
                                    >
                                        Level up: start{" "}
                                        {LEVEL_LABEL[ladderLevelUp.to]}
                                        <Icon icon={ArrowRight} />
                                    </Button>
                                </div>
                            ) : null}
                            <div className="px-4 pb-4">
                                {ladder?.levels.map(levelSection)}
                                {ladder && ladder.reading.length > 0 ? (
                                    <div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start"
                                            aria-expanded={readingOpen}
                                            aria-controls={`${uid}-level-reading`}
                                            onClick={() =>
                                                setReadingOpen((open) => !open)
                                            }
                                        >
                                            <Icon
                                                icon={
                                                    readingOpen
                                                        ? ChevronDown
                                                        : ChevronRight
                                                }
                                                className="text-text-3"
                                            />
                                            <span className="min-w-0 flex-1">
                                                Reading track
                                            </span>
                                            <span className="type-caption text-text-2">
                                                {ladder.reading.filter((entry) => entry.done).length}
                                                /{ladder.reading.length}
                                            </span>
                                        </Button>
                                        {readingOpen ? (
                                            <ItemGroup
                                                id={`${uid}-level-reading`}
                                                variant="plain"
                                                className="mt-1"
                                            >
                                                {ladder.reading.map(
                                                    (entry, position) =>
                                                        lessonRow(
                                                            entry,
                                                            position,
                                                        ),
                                                )}
                                            </ItemGroup>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>

                    <section className="shell">
                        <div className="panel p-4">
                            <Pomodoro />
                        </div>
                    </section>
                </aside>

                <div className="min-w-0 lg:col-span-3">
                    <section className="shell">
                        <div className="panel">
                            <header className="p-4 pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="type-caption text-text-2">
                                        {item.sectionTitle}
                                    </p>
                                    <Field orientation="horizontal">
                                        <FieldLabel>
                                            {done
                                                ? "Completed"
                                                : "Mark complete"}
                                        </FieldLabel>
                                        <Switch
                                            checked={done}
                                            onCheckedChange={onMarkDone}
                                        />
                                    </Field>
                                </div>
                                <h1 className="mt-1 type-title">{title}</h1>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 type-caption text-text-2">
                                    {item.task.estimatedTime && (
                                        <span>{item.task.estimatedTime}</span>
                                    )}
                                    {subtasks.length > 0 && (
                                        <span>
                                            {doneSubtasks}/{subtasks.length}{" "}
                                            steps
                                        </span>
                                    )}
                                    <span>{metaLabel}</span>
                                </div>
                            </header>

                            {completionOpen && completion ? (
                                <div className="mx-4 mb-4 rounded-panel border border-line-faint bg-field p-4">
                                    {completion.core && !recallResolved ? (
                                        <>
                                            <p className="type-label">
                                                Explain it back
                                            </p>
                                            <p className="mt-1 type-caption text-text-2">
                                                Optional. 30 seconds, 1-3
                                                lines, in your own words.
                                            </p>
                                            <div className="mt-2">
                                                <Textarea
                                                    value={recallText}
                                                    onValueChange={setRecallText}
                                                    aria-label="Explain it back"
                                                    limit={400}
                                                    autoGrow
                                                    minRows={3}
                                                    maxRows={6}
                                                />
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={!recallText.trim()}
                                                    onClick={saveRecall}
                                                >
                                                    Save note
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setRecallResolved(true)
                                                    }
                                                >
                                                    Skip
                                                </Button>
                                            </div>
                                        </>
                                    ) : completionLevelUp &&
                                      completionLevelUpTarget ? (
                                        <>
                                            <p className="type-label">
                                                {`Level up: ${LEVEL_LABEL[completionLevelUp.to]}`}
                                            </p>
                                            <p className="mt-1 type-caption text-text-2">
                                                The{" "}
                                                {LEVEL_LABEL[
                                                    completionLevelUp.from
                                                ].toLowerCase()}{" "}
                                                core is done.
                                            </p>
                                            <Button
                                                className="mt-2"
                                                variant="secondary"
                                                size="sm"
                                                render={
                                                    <Link
                                                        to="/learn"
                                                        search={{
                                                            roadmap:
                                                                roadmap.id,
                                                            task: completionLevelUpTarget
                                                                .task.id,
                                                        }}
                                                    />
                                                }
                                                nativeButton={false}
                                            >
                                                Start{" "}
                                                {
                                                    LEVEL_LABEL[
                                                        completionLevelUp.to
                                                    ]
                                                }
                                                <Icon icon={ArrowRight} />
                                            </Button>
                                        </>
                                    ) : completionNext ? (
                                        <>
                                            <p className="type-label">
                                                Next core video
                                            </p>
                                            <p className="mt-1 type-caption text-text-2">
                                                {completionNext.task.title ||
                                                    completionNext.task.text}
                                            </p>
                                            <Button
                                                className="mt-2"
                                                variant="secondary"
                                                size="sm"
                                                render={
                                                    <Link
                                                        to="/learn"
                                                        search={{
                                                            roadmap:
                                                                roadmap.id,
                                                            task: completionNext
                                                                .task.id,
                                                        }}
                                                    />
                                                }
                                                nativeButton={false}
                                            >
                                                Continue
                                                <Icon icon={ArrowRight} />
                                            </Button>
                                        </>
                                    ) : (
                                        <p className="type-caption text-text-2">
                                            Every core video is watched.
                                        </p>
                                    )}
                                </div>
                            ) : null}

                            <div className="border-t border-line-faint px-4 pt-4">
                                <SegmentedControl
                                    aria-label="Lesson views"
                                    value={tab}
                                    onValueChange={(value) =>
                                        setTab(value as TabKey)
                                    }
                                >
                                    <SegmentedControlItem value="read">
                                        Read
                                    </SegmentedControlItem>
                                    <SegmentedControlItem
                                        value="check"
                                        count={subtasks.length || undefined}
                                    >
                                        Check
                                    </SegmentedControlItem>
                                    <SegmentedControlItem value="apply">
                                        Apply
                                    </SegmentedControlItem>
                                </SegmentedControl>
                            </div>

                            <div className="p-4">
                                <section
                                    aria-label="Read"
                                    hidden={tab !== "read"}
                                >
                                    <div className="flex flex-col gap-4">
                                        {brief ? (
                                            <p className="type-body">
                                                {brief}
                                            </p>
                                        ) : (
                                            <p className="type-body-sm text-text-2">
                                                No written brief yet. The
                                                source and your notes are the
                                                lesson.
                                            </p>
                                        )}

                                        {(contextDescription ||
                                            objectives.length > 0 ||
                                            concepts ||
                                            sectionNotes) && (
                                            <section>
                                                <h2 className="type-heading-sm">
                                                    In this module
                                                </h2>
                                                <div className="mt-2 flex flex-col gap-2 type-body-sm text-text-2">
                                                    {contextDescription && (
                                                        <p>
                                                            {contextDescription}
                                                        </p>
                                                    )}
                                                    {concepts && (
                                                        <p>
                                                            <b>Concepts · </b>
                                                            {concepts}
                                                        </p>
                                                    )}
                                                    {sectionNotes && (
                                                        <p>{sectionNotes}</p>
                                                    )}
                                                </div>
                                                {objectives.length > 0 && (
                                                    <ul className="mt-3 flex flex-col gap-1.5">
                                                        {objectives.map(
                                                            (
                                                                objective,
                                                                objectiveIndex,
                                                            ) => (
                                                                <li
                                                                    key={`${objectiveIndex}:${objective}`}
                                                                    className="flex items-baseline gap-2 type-body-sm"
                                                                >
                                                                    <span className="type-caption text-text-3">
                                                                        {String(
                                                                            objectiveIndex +
                                                                                1,
                                                                        ).padStart(
                                                                            2,
                                                                            "0",
                                                                        )}
                                                                    </span>
                                                                    <span>
                                                                        {
                                                                            objective
                                                                        }
                                                                    </span>
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                )}
                                            </section>
                                        )}

                                        <section>
                                            <h2 className="type-heading-sm">
                                                Sources
                                            </h2>
                                            {sources.length > 0 ? (
                                                <div className="mt-2 flex flex-col">
                                                    {sources.map(
                                                        (resource) => (
                                                            <a
                                                                key={
                                                                    resource.id
                                                                }
                                                                className="flex items-center gap-3 rounded-tag px-2 py-2 hover:bg-field"
                                                                href={
                                                                    safeResourceUrl(
                                                                        resource.url,
                                                                    ) ?? "#"
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <span className="shrink-0 type-caption text-text-3">
                                                                    {
                                                                        resource.type
                                                                    }
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <b className="block truncate type-body-sm text-text-1">
                                                                        {resource.title ||
                                                                            resource.url}
                                                                    </b>
                                                                    {resource.description && (
                                                                        <small className="block truncate type-caption text-text-2">
                                                                            {
                                                                                resource.description
                                                                            }
                                                                        </small>
                                                                    )}
                                                                </span>
                                                                <Icon
                                                                    icon={
                                                                        External
                                                                    }
                                                                    className="text-text-3"
                                                                />
                                                            </a>
                                                        ),
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="mt-2 type-body-sm text-text-2">
                                                    No source is attached to
                                                    this lesson yet.
                                                </p>
                                            )}
                                        </section>
                                    </div>
                                </section>

                                <section
                                    aria-label="Check"
                                    hidden={tab !== "check"}
                                >
                                    <div className="flex flex-col gap-4">
                                        <header>
                                            <h2 className="type-heading-sm">
                                                Check what stuck
                                            </h2>
                                            <p className="mt-1 type-body-sm text-text-2">
                                                {videoChecks.state.kind ===
                                                "off"
                                                    ? "Tick the steps you finished. This is a record, not a grade."
                                                    : "Answer from memory first, then look at the video. Nothing here is graded."}
                                            </p>
                                        </header>

                                        {videoChecks.state.kind !== "off" && (
                                            <section>
                                                <h2 className="type-heading-sm">
                                                    From memory
                                                </h2>
                                                <div className="mt-2">
                                                    <VideoChecksStatus
                                                        state={
                                                            videoChecks.state
                                                        }
                                                        onRetry={
                                                            videoChecks.retry
                                                        }
                                                    />
                                                    {videoChecks.state.kind ===
                                                        "ready" &&
                                                        (checks.length ===
                                                        0 ? (
                                                            <p className="type-body-sm text-text-2">
                                                                No questions
                                                                came out of
                                                                this video.
                                                            </p>
                                                        ) : nextCheck ? (
                                                            <RecallPrompt
                                                                check={
                                                                    nextCheck
                                                                }
                                                                eyebrow={`Question ${checks.indexOf(nextCheck) + 1} of ${checks.length} · ${nextCheck.label}`}
                                                                doneLabel={
                                                                    pendingChecks.length >
                                                                    1
                                                                        ? "Next question"
                                                                        : "Done"
                                                                }
                                                                onDone={() =>
                                                                    finishCheck(
                                                                        nextCheck.id,
                                                                    )
                                                                }
                                                                onSkip={() =>
                                                                    finishCheck(
                                                                        nextCheck.id,
                                                                    )
                                                                }
                                                                onReplay={seek}
                                                            />
                                                        ) : (
                                                            <p className="type-body-sm text-text-2">
                                                                All{" "}
                                                                {checks.length}{" "}
                                                                answered.
                                                                Missed one?
                                                                Replay it
                                                                below.
                                                            </p>
                                                        ))}
                                                    {answeredList.length >
                                                        0 && (
                                                        <ul className="mt-3 flex flex-col gap-1">
                                                            {answeredList.map(
                                                                (check) => (
                                                                    <li
                                                                        key={
                                                                            check.id
                                                                        }
                                                                        className="flex items-baseline gap-2 type-body-sm"
                                                                    >
                                                                        <span className="min-w-0 flex-1">
                                                                            {
                                                                                check.question
                                                                            }
                                                                        </span>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                seek(
                                                                                    check.sourceStart,
                                                                                )
                                                                            }
                                                                        >
                                                                            {formatTimestamp(
                                                                                check.sourceStart,
                                                                            )}
                                                                        </Button>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    )}
                                                </div>
                                            </section>
                                        )}

                                        {subtasks.length > 0 &&
                                            videoChecks.state.kind !==
                                                "off" && (
                                                <h2 className="type-heading-sm">
                                                    Steps you finished
                                                </h2>
                                            )}

                                        {subtasks.length > 0 ? (
                                            <ul className="flex flex-col gap-3">
                                                {subtasks.map((subtask) => (
                                                    <li key={subtask.id}>
                                                        <Field orientation="horizontal">
                                                            <FieldLabel className="flex-1">
                                                                {subtask.title}
                                                            </FieldLabel>
                                                            <Switch
                                                                checked={
                                                                    subtask.completed
                                                                }
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) =>
                                                                    setLearningSubtaskDone(
                                                                        roadmap,
                                                                        item
                                                                            .task
                                                                            .id,
                                                                        subtask.id,
                                                                        checked,
                                                                    )
                                                                }
                                                            />
                                                        </Field>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div>
                                                <p className="type-body-sm text-text-2">
                                                    This lesson has no
                                                    checklist or quiz yet.
                                                </p>
                                                <Button
                                                    className="mt-2"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        setTab("apply")
                                                    }
                                                >
                                                    Go to the practice note
                                                    <Icon icon={ArrowRight} />
                                                </Button>
                                            </div>
                                        )}

                                        {item.task.notes && (
                                            <section>
                                                <h2 className="type-heading-sm">
                                                    From your roadmap
                                                </h2>
                                                <p className="mt-2 type-body-sm text-text-2">
                                                    {item.task.notes}
                                                </p>
                                            </section>
                                        )}
                                    </div>
                                </section>

                                <section
                                    aria-label="Apply"
                                    hidden={tab !== "apply"}
                                >
                                    <div className="flex flex-col gap-4">
                                        <header>
                                            <h2 className="type-heading-sm">
                                                Apply it
                                            </h2>
                                            <p className="mt-1 type-body-sm text-text-2">
                                                Optional. Use one idea in your
                                                own work, then keep what you
                                                learned.
                                            </p>
                                        </header>

                                        <Field>
                                            <FieldLabel>
                                                Practice note
                                            </FieldLabel>
                                            <Textarea
                                                value={practice}
                                                onValueChange={setPractice}
                                                placeholder={
                                                    "What I tried:\n\nWhat happened:\n\nWhat I would change:"
                                                }
                                                autoGrow
                                                minRows={5}
                                                maxRows={14}
                                            />
                                        </Field>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                disabled={!practice.trim()}
                                                onClick={savePractice}
                                            >
                                                Save practice note
                                            </Button>
                                            {practiceSaved && (
                                                <span
                                                    className="flex items-center gap-1 type-caption text-text-2"
                                                    role="status"
                                                >
                                                    <Icon icon={Check} />
                                                    Saved
                                                </span>
                                            )}
                                        </div>

                                        <section>
                                            <h2 className="type-heading-sm">
                                                Keep a concept for review
                                            </h2>
                                            <p className="mt-1 type-caption text-text-2">
                                                Reviews are opt-in. Only the
                                                cards you make come back later.
                                            </p>
                                            <div className="mt-3 flex flex-col gap-3">
                                                <ReviewComposer
                                                    key={item.task.id}
                                                    roadmapId={roadmap.id}
                                                    source={{
                                                        url: activeUrl,
                                                        taskId: item.task.id,
                                                        seconds: position,
                                                    }}
                                                    initialAnswer={practice}
                                                />
                                                <TermComposer
                                                    key={`term:${item.task.id}`}
                                                    roadmapId={roadmap.id}
                                                />
                                            </div>
                                        </section>

                                        <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line-faint bg-field p-4">
                                            {next ? (
                                                <>
                                                    <div className="min-w-0">
                                                        <p className="type-caption text-text-2">
                                                            Next core video
                                                        </p>
                                                        <p className="type-body-sm text-text-1">
                                                            {next.task.title ||
                                                                next.task
                                                                    .text ||
                                                                "Untitled lesson"}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        render={
                                                            <Link
                                                                to="/learn"
                                                                search={{
                                                                    roadmap:
                                                                        roadmap.id,
                                                                    task: next
                                                                        .task
                                                                        .id,
                                                                }}
                                                            />
                                                        }
                                                        nativeButton={false}
                                                    >
                                                        Continue
                                                        <Icon
                                                            icon={ArrowRight}
                                                        />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="min-w-0">
                                                        <p className="type-caption text-text-2">
                                                            Last lesson
                                                        </p>
                                                        <p className="type-body-sm text-text-1">
                                                            You are at the end
                                                            of this roadmap.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        render={
                                                            <Link to="/workspaces" />
                                                        }
                                                        nativeButton={false}
                                                    >
                                                        All learning topics
                                                    </Button>
                                                </>
                                            )}
                                        </section>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
