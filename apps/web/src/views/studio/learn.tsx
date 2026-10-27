import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
    ArrowRight,
    Check,
    ExternalLink,
    Plus,
    Trash2,
} from "lucide-react";
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
import { Pomodoro } from "@/components/learning/Pomodoro";
import ReviewComposer from "@/components/learning/ReviewComposer";

type TabKey = "read" | "check" | "apply";
const TAB_ORDER: TabKey[] = ["read", "check", "apply"];

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
    const navigate = useNavigate();
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
    const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
        read: null,
        check: null,
        apply: null,
    });
    const uid = useId().replace(/:/g, "");
    const tabId = (key: TabKey) => `${uid}-tab-${key}`;
    const panelId = (key: TabKey) => `${uid}-panel-${key}`;

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
                    color: "#b7c9e8",
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
                    color: "#b7c9e8",
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
                    color: "#b7c9e8",
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
        const updated = setLearningTaskDone(roadmap, item.task.id, checked);
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

    function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % TAB_ORDER.length;
        else if (event.key === "ArrowLeft")
            next = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = TAB_ORDER.length - 1;
        else return;
        event.preventDefault();
        const key = TAB_ORDER[next];
        setTab(key);
        tabRefs.current[key]?.focus();
    }

    if (!loaded)
        return (
            <div className="sy-desk sy-desk-simple" aria-busy="true">
                <p className="sy-desk-empty">Loading your learning topic…</p>
            </div>
        );
    if (!roadmap)
        return (
            <div className="sy-desk sy-desk-simple">
                <div className="sy-desk-simple-inner">
                    <p className="sy-desk-eyebrow">Learn</p>
                    <h1>
                        {roadmapId
                            ? "This learning topic is not on this device"
                            : "Start a learning topic"}
                    </h1>
                    <p className="sy-desk-lede">
                        {roadmapId
                            ? "It may have been deleted here, or it only exists on another device."
                            : "Start with a goal, or organize resources you already have."}
                    </p>
                    <div className="sy-desk-actions">
                        <Link className="sy-button primary" to="/scout">
                            Open Scout
                            <ArrowRight />
                        </Link>
                        <Link className="sy-button secondary" to="/create">
                            Add your own roadmap
                        </Link>
                    </div>
                </div>
            </div>
        );
    if (!item)
        return (
            <div className="sy-desk sy-desk-simple">
                <div className="sy-desk-simple-inner">
                    <p className="sy-desk-eyebrow">{roadmap.title}</p>
                    <h1>This roadmap has no lessons yet</h1>
                    <p className="sy-desk-lede">
                        Open its workspace to add tasks and resources, or
                        explore what it already holds.
                    </p>
                    <div className="sy-desk-actions">
                        <Link
                            className="sy-button primary"
                            to="/workspace/$id"
                            params={{ id: roadmap.id }}
                        >
                            Open full workspace
                            <ArrowRight />
                        </Link>
                    </div>
                </div>
            </div>
        );

    const index = tasks.findIndex(
        (entry) => entry.task.id === item.task.id,
    );
    const title = item.task.title || item.task.text || "Untitled lesson";
    const done = item.task.completed || !!item.task.done;
    const next = nextCoreItem(roadmap, { excludeTaskId: item.task.id });
    const countLabel = openInfo
        ? openInfo.level === null
            ? "READING TRACK"
            : openInfo.item.role === "core"
              ? `${LEVEL_LABEL[openInfo.level.level].toUpperCase()} · CORE ${openInfo.coreIndex + 1} / ${openInfo.level.coreTotal}`
              : `${LEVEL_LABEL[openInfo.level.level].toUpperCase()} · GO DEEPER`
        : `LESSON ${index + 1} / ${tasks.length}`;
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
            <li key={entry.task.id}>
                <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    onClick={() => {
                        if (current) return;
                        void navigate({
                            to: "/learn",
                            search: {
                                roadmap: roadmap.id,
                                task: entry.task.id,
                            },
                        });
                    }}
                >
                    <span className="sy-desk-mono">
                        {String(position + 1).padStart(2, "0")}
                    </span>
                    <span>
                        {entry.task.title || entry.task.text || "Untitled lesson"}
                        {entry.role === "core" && entry.task.coreReason ? (
                            <small className="sy-desk-reason">
                                {entry.task.coreReason}
                            </small>
                        ) : null}
                    </span>
                    <span
                        className="sy-desk-pip"
                        data-done={entry.done || undefined}
                        aria-hidden="true"
                    />
                </button>
            </li>
        );
    };

    const levelSection = (level: LadderLevel) => {
        const open = isLevelOpen(level.level);
        const panelId = `${uid}-level-${level.level}`;
        return (
            <div key={level.level} className="sy-desk-level">
                <button
                    type="button"
                    className="sy-desk-level-head"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleLevel(level.level)}
                >
                    <span>{LEVEL_LABEL[level.level]}</span>
                    <span className="sy-desk-mono">
                        {level.coreDone}/{level.coreTotal} core
                    </span>
                    {level.complete ? (
                        <span className="sy-desk-level-tag">Done</span>
                    ) : level.level === ladder?.current ? (
                        <span className="sy-desk-level-tag">Up next</span>
                    ) : null}
                </button>
                {open ? (
                    <ol id={panelId}>
                        {level.core.map((entry, position) =>
                            lessonRow(entry, position),
                        )}
                        {level.deeper.length > 0 && (
                            <li className="sy-desk-deeper-head">
                                Go deeper (optional)
                            </li>
                        )}
                        {level.deeper.map((entry, position) =>
                            lessonRow(entry, position),
                        )}
                    </ol>
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
        <div className="sy-desk">
            <header className="sy-desk-top">
                <nav className="sy-desk-crumb" aria-label="Breadcrumb">
                    <Link to="/workspaces">Learning topics</Link>
                    <span className="sy-desk-crumb-sep">/</span>
                    <span className="sy-desk-crumb-topic">
                        {roadmap.title}
                    </span>
                    <span className="sy-desk-crumb-sep">/</span>
                    <b>{title}</b>
                </nav>
                <div className="sy-desk-top-right">
                    <span className="sy-desk-count">{countLabel}</span>
                    <Link
                        className="sy-button quiet"
                        to="/workspace/$id"
                        params={{ id: roadmap.id }}
                        title="Edit roadmap"
                    >
                        <span className="sy-desk-edit-label">
                            Edit roadmap
                        </span>
                        <ExternalLink />
                    </Link>
                </div>
            </header>

            {error && (
                <div className="sy-desk-alert">
                    <p role="alert" className="sy-error">
                        {error}
                    </p>
                </div>
            )}

            <div className="sy-desk-grid">
                <aside className="sy-desk-work" aria-label="Video and notes">
                    <div className="sy-desk-card sy-desk-video">
                        <div className="sy-desk-card-head sy-desk-video-head">
                            <span className="sy-desk-live">
                                <i aria-hidden="true" />
                                {videoResource
                                    ? "Watch the walkthrough"
                                    : "Lesson source"}
                            </span>
                            {video?.duration && (
                                <span className="sy-desk-mono">
                                    {video.duration}
                                </span>
                            )}
                        </div>
                        {videoResource ? (
                            <div className="sy-desk-video-body">
                                <StudyVideo
                                    key={`${item.task.id}:${videoResource.url}`}
                                    url={videoResource.url}
                                    title={
                                        video?.title || videoResource.title
                                    }
                                    startSeconds={startSeconds}
                                    seekTo={seekTo}
                                    onPosition={recordPosition}
                                />
                            </div>
                        ) : (
                            <div className="sy-desk-video-empty">
                                <p>
                                    This lesson is reading only. Open a source
                                    from the Read tab.
                                </p>
                            </div>
                        )}
                        <div className="sy-desk-video-foot">
                            <div>
                                <b>
                                    {video?.title ||
                                        videoResource?.title ||
                                        title}
                                </b>
                                {videoResource && (
                                    <span>
                                        Saved at {formatTimestamp(position)}
                                    </span>
                                )}
                            </div>
                            {external && (
                                <a
                                    className="sy-desk-external"
                                    href={external.toString()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    External
                                    <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                        {videoResource && (
                            <details className="sy-desk-manual">
                                <summary>
                                    Update position after listening elsewhere
                                </summary>
                                <div className="sy-desk-manual-row">
                                    <label>
                                        Minutes
                                        <input
                                            className="sy-input"
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            value={manualPosition}
                                            onChange={(event) =>
                                                setManualPosition(
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <button
                                        className="sy-button secondary"
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
                                    </button>
                                </div>
                            </details>
                        )}
                    </div>

                    {chapters.length > 0 && (
                        <div className="sy-desk-card sy-desk-chapters">
                            <div className="sy-desk-card-head">
                                <b>Chapters</b>
                                <span className="sy-desk-mono">
                                    {chapters.length}
                                </span>
                            </div>
                            <ol>
                                {chapters.map((chapter) => (
                                    <li key={`${chapter.seconds}:${chapter.label}`}>
                                        <button
                                            type="button"
                                            aria-current={
                                                activeChapter ===
                                                chapter.seconds
                                                    ? "true"
                                                    : undefined
                                            }
                                            onClick={() => seek(chapter.seconds)}
                                        >
                                            <span className="sy-desk-mono">
                                                {chapter.time}
                                            </span>
                                            <span>{chapter.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <div className="sy-desk-card sy-desk-notes">
                        <div className="sy-desk-card-head sy-desk-notes-head">
                            <b>Notes</b>
                            <span className="sy-desk-mono">
                                at {formatTimestamp(position)}
                            </span>
                        </div>
                        <form
                            className="sy-desk-note-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveNote();
                            }}
                        >
                            <textarea
                                rows={1}
                                value={draft}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                placeholder="A thought, a question…"
                                aria-label="New note"
                            />
                            <button
                                type="submit"
                                aria-label="Save note"
                                disabled={!draft.trim()}
                            >
                                <Plus size={14} />
                            </button>
                        </form>
                        {notes.length === 0 ? (
                            <p className="sy-desk-notes-empty">
                                No notes yet. They attach to{" "}
                                {formatTimestamp(position)}.
                            </p>
                        ) : (
                            <ul className="sy-desk-note-list">
                                {notes.map((note) => (
                                    <li key={note.id}>
                                        <button
                                            type="button"
                                            className="sy-desk-note-time"
                                            onClick={() => seek(note.seconds)}
                                        >
                                            {formatTimestamp(note.seconds)}
                                        </button>
                                        <p>{note.text}</p>
                                        <button
                                            type="button"
                                            className="sy-desk-note-del"
                                            aria-label="Delete note"
                                            onClick={() =>
                                                removePersonalEntry(note.id)
                                            }
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="sy-desk-card sy-desk-lessons">
                        <div className="sy-desk-card-head">
                            <b>Ladder</b>
                            <span className="sy-desk-mono">
                                {ladder
                                    ? `${ladder.levels.reduce((total, level) => total + level.coreDone, 0)}/${ladder.levels.reduce((total, level) => total + level.coreTotal, 0)} core`
                                    : "0/0 core"}
                            </span>
                        </div>
                        {ladderLevelUp && ladderLevelUpTarget ? (
                            <Link
                                className="sy-desk-levelup"
                                to="/learn"
                                search={{
                                    roadmap: roadmap.id,
                                    task: ladderLevelUpTarget.task.id,
                                }}
                            >
                                Level up: start{" "}
                                {LEVEL_LABEL[ladderLevelUp.to]}
                                <ArrowRight />
                            </Link>
                        ) : null}
                        {ladder?.levels.map(levelSection)}
                        {ladder && ladder.reading.length > 0 ? (
                            <div className="sy-desk-level">
                                <button
                                    type="button"
                                    className="sy-desk-level-head"
                                    aria-expanded={readingOpen}
                                    aria-controls={`${uid}-level-reading`}
                                    onClick={() =>
                                        setReadingOpen((open) => !open)
                                    }
                                >
                                    <span>Reading track</span>
                                    <span className="sy-desk-mono">
                                        {ladder.reading.filter((entry) => entry.done).length}
                                        /{ladder.reading.length}
                                    </span>
                                </button>
                                {readingOpen ? (
                                    <ol id={`${uid}-level-reading`}>
                                        {ladder.reading.map((entry, position) =>
                                            lessonRow(entry, position),
                                        )}
                                    </ol>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="sy-desk-card sy-desk-pomodoro-card">
                        <Pomodoro />
                    </div>
                </aside>

                <div className="sy-desk-panel">
                    <header className="sy-desk-claim">
                        <div className="sy-desk-claim-top">
                            <p className="sy-desk-eyebrow">
                                {item.sectionTitle}
                            </p>
                            <label className="sy-desk-done">
                                <input
                                    type="checkbox"
                                    checked={done}
                                    onChange={(event) =>
                                        onMarkDone(event.target.checked)
                                    }
                                />
                                <span>
                                    {done ? "Completed" : "Mark complete"}
                                </span>
                            </label>
                        </div>
                        <h1>{title}</h1>
                        <div className="sy-desk-claim-meta">
                            {item.task.estimatedTime && (
                                <span>{item.task.estimatedTime}</span>
                            )}
                            {subtasks.length > 0 && (
                                <span>
                                    {doneSubtasks}/{subtasks.length} steps
                                </span>
                            )}
                            <span>{metaLabel}</span>
                        </div>
                    </header>

                    {completionOpen && completion ? (
                        <div className="sy-desk-card sy-desk-recall">
                            {completion.core && !recallResolved ? (
                                <>
                                    <p className="sy-desk-eyebrow">
                                        Explain it back
                                    </p>
                                    <p className="sy-desk-recall-hint">
                                        Optional. 30 seconds, 1–3 lines, in
                                        your own words.
                                    </p>
                                    <textarea
                                        className="sy-textarea"
                                        rows={3}
                                        maxLength={400}
                                        value={recallText}
                                        onChange={(event) =>
                                            setRecallText(event.target.value)
                                        }
                                        aria-label="Explain it back"
                                    />
                                    <div className="sy-desk-actions">
                                        <button
                                            type="button"
                                            className="sy-button primary"
                                            disabled={!recallText.trim()}
                                            onClick={saveRecall}
                                        >
                                            Save note
                                        </button>
                                        <button
                                            type="button"
                                            className="sy-button quiet"
                                            onClick={() =>
                                                setRecallResolved(true)
                                            }
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </>
                            ) : completionLevelUp && completionLevelUpTarget ? (
                                <>
                                    <p className="sy-desk-eyebrow">
                                        {`Level up: ${LEVEL_LABEL[completionLevelUp.to]}`}
                                    </p>
                                    <p className="sy-desk-recall-hint">
                                        The {LEVEL_LABEL[completionLevelUp.from].toLowerCase()} core is done.
                                    </p>
                                    <Link
                                        className="sy-button primary"
                                        to="/learn"
                                        search={{
                                            roadmap: roadmap.id,
                                            task: completionLevelUpTarget.task
                                                .id,
                                        }}
                                    >
                                        Start {LEVEL_LABEL[completionLevelUp.to]}
                                        <ArrowRight />
                                    </Link>
                                </>
                            ) : completionNext ? (
                                <>
                                    <p className="sy-desk-eyebrow">
                                        Next core video
                                    </p>
                                    <p className="sy-desk-recall-hint">
                                        {completionNext.task.title ||
                                            completionNext.task.text}
                                    </p>
                                    <Link
                                        className="sy-button primary"
                                        to="/learn"
                                        search={{
                                            roadmap: roadmap.id,
                                            task: completionNext.task.id,
                                        }}
                                    >
                                        Continue
                                        <ArrowRight />
                                    </Link>
                                </>
                            ) : (
                                <p className="sy-desk-recall-hint">
                                    Every core video is watched.
                                </p>
                            )}
                        </div>
                    ) : null}

                    <div
                        className="sy-desk-tabs"
                        role="tablist"
                        aria-label="Lesson views"
                    >
                        {TAB_ORDER.map((key, tabIndex) => {
                            const count =
                                key === "check"
                                    ? subtasks.length
                                    : key === "apply"
                                      ? 1
                                      : 0;
                            return (
                                <button
                                    key={key}
                                    ref={(node) => {
                                        tabRefs.current[key] = node;
                                    }}
                                    id={tabId(key)}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    aria-controls={panelId(key)}
                                    tabIndex={tab === key ? 0 : -1}
                                    onClick={() => setTab(key)}
                                    onKeyDown={(event) =>
                                        onTabKey(event, tabIndex)
                                    }
                                >
                                    {key === "read"
                                        ? "Read"
                                        : key === "check"
                                          ? "Check"
                                          : "Apply"}
                                    {count > 0 && (
                                        <span className="sy-desk-tab-count">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="sy-desk-surface">
                        <section
                            className="sy-desk-tab"
                            id={panelId("read")}
                            role="tabpanel"
                            aria-labelledby={tabId("read")}
                            hidden={tab !== "read"}
                        >
                            <div className="sy-desk-copy">
                                {brief ? (
                                    <p className="sy-desk-lede">{brief}</p>
                                ) : (
                                    <p className="sy-desk-empty">
                                        No written brief yet. The source and
                                        your notes are the lesson.
                                    </p>
                                )}

                                {(contextDescription ||
                                    objectives.length > 0 ||
                                    concepts ||
                                    sectionNotes) && (
                                    <section className="sy-desk-block">
                                        <h2>In this module</h2>
                                        <div className="sy-desk-prose">
                                            {contextDescription && (
                                                <p>{contextDescription}</p>
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
                                            <ul className="sy-desk-objectives">
                                                {objectives.map(
                                                    (objective, objectiveIndex) => (
                                                        <li
                                                            key={`${objectiveIndex}:${objective}`}
                                                        >
                                                            <span className="sy-desk-mono">
                                                                {String(
                                                                    objectiveIndex +
                                                                        1,
                                                                ).padStart(
                                                                    2,
                                                                    "0",
                                                                )}
                                                            </span>
                                                            <span>
                                                                {objective}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </section>
                                )}

                                <section className="sy-desk-block">
                                    <h2>Sources</h2>
                                    {sources.length > 0 ? (
                                        <div className="sy-desk-source-list">
                                            {sources.map((resource) => (
                                                <a
                                                    key={resource.id}
                                                    className="sy-desk-source"
                                                    href={
                                                        safeResourceUrl(
                                                            resource.url,
                                                        ) ?? "#"
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <span className="sy-desk-source-type sy-desk-mono">
                                                        {resource.type}
                                                    </span>
                                                    <span className="sy-desk-source-body">
                                                        <b>
                                                            {resource.title ||
                                                                resource.url}
                                                        </b>
                                                        {resource.description && (
                                                            <small>
                                                                {
                                                                    resource.description
                                                                }
                                                            </small>
                                                        )}
                                                    </span>
                                                    <ExternalLink size={14} />
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="sy-desk-empty">
                                            No source is attached to this
                                            lesson yet.
                                        </p>
                                    )}
                                </section>
                            </div>
                        </section>

                        <section
                            className="sy-desk-tab"
                            id={panelId("check")}
                            role="tabpanel"
                            aria-labelledby={tabId("check")}
                            hidden={tab !== "check"}
                        >
                            <div className="sy-desk-copy">
                                <header className="sy-desk-tab-head">
                                    <h2>Check what stuck</h2>
                                    <p>
                                        Tick the steps you finished. This is a
                                        record, not a grade.
                                    </p>
                                </header>

                                {subtasks.length > 0 ? (
                                    <ul className="sy-desk-subtasks">
                                        {subtasks.map((subtask) => (
                                            <li key={subtask.id}>
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            subtask.completed
                                                        }
                                                        onChange={(event) =>
                                                            setLearningSubtaskDone(
                                                                roadmap,
                                                                item.task.id,
                                                                subtask.id,
                                                                event.target
                                                                    .checked,
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {subtask.title}
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <>
                                        <p className="sy-desk-empty">
                                            This lesson has no checklist or
                                            quiz yet.
                                        </p>
                                        <button
                                            className="sy-button secondary"
                                            onClick={() => setTab("apply")}
                                        >
                                            Go to the practice note
                                            <ArrowRight />
                                        </button>
                                    </>
                                )}

                                {item.task.notes && (
                                    <section className="sy-desk-block">
                                        <h2>From your roadmap</h2>
                                        <div className="sy-desk-prose">
                                            <p>{item.task.notes}</p>
                                        </div>
                                    </section>
                                )}
                            </div>
                        </section>

                        <section
                            className="sy-desk-tab"
                            id={panelId("apply")}
                            role="tabpanel"
                            aria-labelledby={tabId("apply")}
                            hidden={tab !== "apply"}
                        >
                            <div className="sy-desk-copy">
                                <header className="sy-desk-tab-head">
                                    <h2>Apply it</h2>
                                    <p>
                                        Optional. Use one idea in your own
                                        work, then keep what you learned.
                                    </p>
                                </header>

                                <label className="sy-desk-field">
                                    <span>Practice note</span>
                                    <textarea
                                        className="sy-textarea"
                                        value={practice}
                                        onChange={(event) =>
                                            setPractice(event.target.value)
                                        }
                                        placeholder={
                                            "What I tried:\n\nWhat happened:\n\nWhat I would change:"
                                        }
                                    />
                                </label>
                                <div className="sy-desk-actions">
                                    <button
                                        className="sy-button primary"
                                        disabled={!practice.trim()}
                                        onClick={savePractice}
                                    >
                                        Save practice note
                                    </button>
                                    {practiceSaved && (
                                        <span
                                            className="sy-desk-saved"
                                            role="status"
                                        >
                                            <Check size={13} />
                                            Saved
                                        </span>
                                    )}
                                </div>

                                <section className="sy-desk-block sy-desk-review">
                                    <h2>Keep a concept for review</h2>
                                    <p className="sy-desk-hint">
                                        Reviews are opt-in. Only the cards you
                                        make come back later.
                                    </p>
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
                                </section>

                                <section className="sy-desk-next">
                                    {next ? (
                                        <>
                                            <div>
                                                <span className="sy-desk-eyebrow">
                                                    Next core video
                                                </span>
                                                <p>
                                                    {next.task.title ||
                                                        next.task.text ||
                                                        "Untitled lesson"}
                                                </p>
                                            </div>
                                            <Link
                                                className="sy-button primary"
                                                to="/learn"
                                                search={{
                                                    roadmap: roadmap.id,
                                                    task: next.task.id,
                                                }}
                                            >
                                                Continue
                                                <ArrowRight />
                                            </Link>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <span className="sy-desk-eyebrow">
                                                    Last lesson
                                                </span>
                                                <p>
                                                    You are at the end of this
                                                    roadmap.
                                                </p>
                                            </div>
                                            <Link
                                                className="sy-button secondary"
                                                to="/workspaces"
                                            >
                                                All learning topics
                                            </Link>
                                        </>
                                    )}
                                </section>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
