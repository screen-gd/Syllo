import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";
import {
    getLearningTasks,
    nextLearningTask,
    safeResourceUrl,
    setLearningTaskDone,
    taskVideo,
} from "@/lib/learning";
import { getVideoStartSeconds } from "@/lib/video-utils";
import { formatTimestamp } from "@/lib/scout/format";
import {
    getPersonalSnapshot,
    personalEntries,
    putPersonalEntry,
    usePersonalData,
} from "@/lib/personal/store";
import StudyVideo from "@/components/learning/StudyVideo";
import { Pomodoro } from "@/components/learning/Pomodoro";
import ReviewComposer from "@/components/learning/ReviewComposer";

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
    const item =
        tasks.find((entry) => entry.task.id === taskId) ??
        (roadmap ? (nextLearningTask(roadmap) ?? tasks[0]) : null);
    const video = item ? taskVideo(item) : null;
    const [draft, setDraft] = useState("");
    const [tab, setTab] = useState<"notes" | "roadmap">("notes");
    const [seekTo, setSeekTo] = useState<number | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);
    const [position, setPosition] = useState(0);
    const positionRef = useRef(0);
    const startRef = useRef(0);
    const [manualPosition, setManualPosition] = useState("");
    const [error, setError] = useState<string | null>(null);
    const activeId = item?.task.id;
    const activeRoadmap = roadmap?.id;
    const activeUrl = video?.url ?? item?.resources[0]?.url ?? "";
    const notes = personalEntries(records, "annotation")
        .filter(
            (entry) =>
                entry.data.anchor.kind === "lesson" &&
                entry.data.anchor.roadmapId === roadmap?.id &&
                entry.data.anchor.taskId === item?.task.id,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
    useEffect(() => {
        if (!activeId || !activeRoadmap) return;
        const stored =
            getPersonalSnapshot()[`study:${activeRoadmap}:${activeId}`];
        const seconds =
            targetSeconds ??
            (stored?.kind === "study" && stored.data.resourceUrl === activeUrl
                ? stored.data.seconds
                : getVideoStartSeconds(activeUrl));
        startRef.current = seconds;
        positionRef.current = seconds;
        setPosition(seconds);
        setSeekTo(null);
        setDraft("");
        setError(null);
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
    }, [activeId, activeRoadmap, activeUrl, targetSeconds]);
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
        } catch {
            setError(
                "Your note could not be saved. Free some browser storage and try again.",
            );
        }
    }
    if (!loaded)
        return (
            <div className="sy-page sy-loading">
                Loading your learning topic…
            </div>
        );
    if (!roadmap)
        return (
            <div className="sy-page">
                <h1>Learn</h1>
                <div className="sy-empty">
                    <p>
                        {roadmapId
                            ? "This learning topic could not be found on this device."
                            : "Start with a goal, or organize resources you already have."}
                    </p>
                    <Link className="sy-button primary" to="/scout">
                        Open Scout
                        <ArrowRight />
                    </Link>
                    <Link className="sy-button quiet" to="/create">
                        Add your own roadmap
                    </Link>
                </div>
            </div>
        );
    if (!item)
        return (
            <div className="sy-page">
                <h1>{roadmap.title}</h1>
                <div className="sy-empty">
                    <p>
                        This roadmap has no task list yet. Open its full
                        workspace to add tasks or explore its resources.
                    </p>
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
        );
    const source = safeResourceUrl(activeUrl);
    const external = source ? new URL(source) : null;
    if (external && video)
        external.searchParams.set("t", `${Math.floor(position)}s`);
    const saved = records[`study:${roadmap.id}:${item.task.id}`];
    const startSeconds =
        targetSeconds ??
        (saved?.kind === "study"
            ? saved.data.seconds
            : getVideoStartSeconds(activeUrl));
    return (
        <div className="sy-page">
            <div className="sy-breadcrumb">
                <Link to="/workspaces">Your learning topics</Link>
                <span>/</span>
                <span>{roadmap.title}</span>
            </div>
            <header className="sy-page-head">
                <div>
                    <h1>{item.task.title || item.task.text}</h1>
                    <p>{item.sectionTitle}</p>
                </div>
                <Link
                    className="sy-button quiet"
                    to="/workspace/$id"
                    params={{ id: roadmap.id }}
                >
                    Edit roadmap
                    <ExternalLink />
                </Link>
            </header>
            {error && (
                <p role="alert" className="sy-error">
                    {error}
                </p>
            )}
            <div className="sy-study-grid">
                <div>
                    {video ? (
                        <>
                            <StudyVideo
                                key={`${item.task.id}:${video.url}`}
                                url={video.url}
                                title={video.title}
                                startSeconds={startSeconds}
                                seekTo={seekTo}
                                onPosition={recordPosition}
                            />
                            <div className="sy-video-caption">
                                <span>
                                    Saved at {formatTimestamp(position)}
                                </span>
                                {external && (
                                    <a
                                        href={external.toString()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open in external player ↗
                                    </a>
                                )}
                            </div>
                            <details className="sy-small sy-muted">
                                <summary>
                                    Update position after listening elsewhere
                                </summary>
                                <label
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        marginTop: 10,
                                        alignItems: "center",
                                    }}
                                >
                                    Minutes
                                    <input
                                        className="sy-input"
                                        style={{ maxWidth: 90 }}
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
                                    <button
                                        className="sy-button secondary"
                                        disabled={manualPosition === ""}
                                        onClick={() => {
                                            const seconds = Math.max(
                                                0,
                                                Number(manualPosition) * 60,
                                            );
                                            recordPosition(seconds);
                                            setSeekTo(seconds);
                                        }}
                                    >
                                        Save
                                    </button>
                                </label>
                            </details>
                        </>
                    ) : (
                        item.resources
                            .filter((resource) => safeResourceUrl(resource.url))
                            .map((resource) => (
                                <a
                                    key={resource.id}
                                    className="sy-article-link"
                                    href={safeResourceUrl(resource.url) ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span>{resource.title}</span>
                                    <ExternalLink size={15} />
                                </a>
                            ))
                    )}
                    <section className="sy-section">
                        <h2 className="sy-study-title">This task</h2>
                        {(item.task.description || item.task.text) && (
                            <p className="sy-muted sy-small">
                                {item.task.description || item.task.text}
                            </p>
                        )}
                        <label className="sy-check">
                            <input
                                type="checkbox"
                                checked={
                                    item.task.completed || !!item.task.done
                                }
                                onChange={(event) =>
                                    setLearningTaskDone(
                                        roadmap,
                                        item.task.id,
                                        event.target.checked,
                                    )
                                }
                            />
                            <span>
                                Mark this task complete
                                <small>
                                    Completion records what you did, not
                                    mastery.
                                </small>
                            </span>
                        </label>
                        {item.task.notes && (
                            <p
                                className="sy-muted sy-small"
                                style={{
                                    marginTop: 16,
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {item.task.notes}
                            </p>
                        )}
                    </section>
                    <section className="sy-section">
                        <h2>Try it afterward</h2>
                        <p
                            className="sy-muted sy-small"
                            style={{ marginTop: 8 }}
                        >
                            Use one idea in your own work. Keep a note about
                            what happened.
                        </p>
                        <button
                            className="sy-button quiet"
                            onClick={() => {
                                setDraft(
                                    "What I tried:\n\nWhat happened:\n\nWhat I would change:",
                                );
                                setTab("notes");
                            }}
                        >
                            Write a practice note
                            <ArrowRight />
                        </button>
                    </section>
                    <section className="sy-section">
                        <button
                            className="sy-button quiet"
                            onClick={() => setComposerOpen((value) => !value)}
                        >
                            {composerOpen
                                ? "Close review card"
                                : "Keep a concept for review"}
                        </button>
                        {composerOpen && (
                            <ReviewComposer
                                roadmapId={roadmap.id}
                                source={{
                                    url: activeUrl,
                                    taskId: item.task.id,
                                    seconds: position,
                                }}
                            />
                        )}
                    </section>
                    {item.task.completed && (
                        <div className="sy-section">
                            <Link
                                className="sy-button primary"
                                to="/learn"
                                search={{
                                    roadmap: roadmap.id,
                                    task: nextLearningTask(roadmap)?.task.id,
                                }}
                            >
                                Next unfinished task
                                <ArrowRight />
                            </Link>
                        </div>
                    )}
                </div>
                <aside className="sy-study-aside">
                    <div
                        className="sy-tabs"
                        role="tablist"
                        aria-label="Study panel"
                    >
                        <button
                            role="tab"
                            aria-selected={tab === "notes"}
                            onClick={() => setTab("notes")}
                        >
                            Notes
                        </button>
                        <button
                            role="tab"
                            aria-selected={tab === "roadmap"}
                            onClick={() => setTab("roadmap")}
                        >
                            Roadmap
                        </button>
                    </div>
                    {tab === "notes" ? (
                        <>
                            <textarea
                                className="sy-textarea"
                                value={draft}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                placeholder="Capture an idea in your own words…"
                                aria-label="Lesson note"
                            />
                            <div className="sy-note-controls">
                                <small>
                                    Linked to this task
                                    {video
                                        ? ` at ${formatTimestamp(position)}`
                                        : ""}
                                </small>
                                <button
                                    className="sy-button secondary"
                                    disabled={!draft.trim()}
                                    onClick={saveNote}
                                >
                                    Save note
                                </button>
                            </div>
                            {notes.map((entry) => (
                                <article
                                    className="sy-saved-note"
                                    key={entry.id}
                                >
                                    {entry.data.anchor.kind === "lesson" &&
                                        video && (
                                            <button
                                                className="sy-time-link"
                                                onClick={() => {
                                                    if (
                                                        entry.data.anchor
                                                            .kind === "lesson"
                                                    )
                                                        setSeekTo(
                                                            entry.data.anchor
                                                                .seconds,
                                                        );
                                                }}
                                            >
                                                {formatTimestamp(
                                                    entry.data.anchor.seconds,
                                                )}
                                            </button>
                                        )}
                                    <p>{entry.data.text}</p>
                                </article>
                            ))}
                        </>
                    ) : (
                        tasks.map((task) => (
                            <button
                                key={task.task.id}
                                className="sy-outline-item"
                                aria-current={
                                    item.task.id === task.task.id
                                        ? "step"
                                        : undefined
                                }
                                onClick={() => {
                                    if (draft.trim()) saveNote();
                                    void navigate({
                                        to: "/learn",
                                        search: {
                                            roadmap: roadmap.id,
                                            task: task.task.id,
                                        },
                                    });
                                }}
                            >
                                {task.task.completed || task.task.done ? (
                                    <Check size={14} />
                                ) : (
                                    <span aria-hidden="true">○</span>
                                )}
                                <span className="sy-outline-title">
                                    {task.task.title || task.task.text}
                                </span>
                            </button>
                        ))
                    )}
                    <Pomodoro />
                </aside>
            </div>
        </div>
    );
}
