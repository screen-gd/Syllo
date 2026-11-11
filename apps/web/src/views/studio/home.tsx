import { Link } from "@tanstack/react-router";
import {
    ArrowRight,
    BookOpen,
    Library,
    ListPlus,
    Play,
    Telescope,
} from "lucide-react";
import { useReviews } from "@/hooks/useReviews";
import { taskVideo } from "@/lib/learning";
import { getLadder, levelUpReady, LEVEL_LABEL, nextCoreItem } from "@/lib/ladder";
import { getYouTubeId, getVideoStartSeconds } from "@/lib/video-utils";
import { personalEntries } from "@/lib/personal/store";
import {
    normalizeLearningRecord,
    recentActivity,
} from "@/lib/learning-session";
import { collectNotes } from "@/lib/notes";
import { formatInterval, isDue, isScheduled } from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import { formatTimestamp } from "@/lib/scout/format";
import { topicStyle } from "@/lib/topic-color";
import BookCover from "@/components/learning/BookCover";

/** First things to do on an empty Home, in the order a new learner needs them. */
const STARTERS = [
    {
        to: "/scout",
        icon: Telescope,
        title: "Pick a goal",
        body: "Scout finds the videos and reading for it.",
    },
    {
        to: "/create",
        icon: ListPlus,
        title: "Bring a roadmap",
        body: "Paste notes or links you already have.",
    },
    {
        to: "/library",
        icon: Library,
        title: "Import a book",
        body: "Read an EPUB and keep highlights.",
    },
] as const;

/** Home: what to resume, the week so far, cards waiting and current books. */
export default function HomePage() {
    const { reviews, roadmaps, records, loaded } = useReviews();
    const positions = personalEntries(records, "study")
        .map((item) => item.data)
        .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    const recentRoadmap = positions
        .map((position) =>
            roadmaps.find((roadmap) => roadmap.id === position.roadmapId),
        )
        .find((roadmap) => roadmap && nextCoreItem(roadmap));
    const resumeRoadmap =
        recentRoadmap ?? roadmaps.find((roadmap) => nextCoreItem(roadmap));
    const ladder = resumeRoadmap ? getLadder(resumeRoadmap) : null;
    const resumeTask = resumeRoadmap ? nextCoreItem(resumeRoadmap) : null;
    const resumeLevel = ladder?.levels.find((level) =>
        level.items.some((entry) => entry.task.id === resumeTask?.task.id),
    );
    const levelUp = ladder ? levelUpReady(ladder) : null;
    const lastRoadmap =
        positions
            .map((position) =>
                roadmaps.find((roadmap) => roadmap.id === position.roadmapId),
            )
            .find((roadmap) => roadmap !== undefined) ??
        [...roadmaps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
        null;
    const video = resumeTask ? taskVideo(resumeTask) : null;
    const youtubeId = video ? getYouTubeId(video.url) : null;
    const studyEntry =
        resumeRoadmap && resumeTask
            ? records[`study:${resumeRoadmap.id}:${resumeTask.task.id}`]
            : undefined;
    const seconds =
        video &&
        studyEntry?.kind === "study" &&
        studyEntry.data.resourceUrl === video.url
            ? studyEntry.data.seconds
            : video
              ? getVideoStartSeconds(video.url)
              : 0;
    const books = personalEntries(records, "book")
        .map((item) => item.data)
        .filter((book) => book.status === "reading")
        .sort((a, b) =>
            (b.lastReadAt ?? b.addedAt).localeCompare(
                a.lastReadAt ?? a.addedAt,
            ),
        )
        .slice(0, 3);
    if (!loaded)
        return (
            <div className="sy-page">
                <header className="sy-page-head">
                    <h1>Home</h1>
                </header>
                <div className="sy-home-grid" role="status" aria-label="Loading">
                    <div className="sy-home-main">
                        <div className="sy-box sy-box-skeleton" />
                        <div className="sy-box sy-box-skeleton" />
                    </div>
                    <div className="sy-home-aside">
                        <div className="sy-box sy-box-skeleton short" />
                        <div className="sy-box sy-box-skeleton short" />
                    </div>
                </div>
            </div>
        );

    const record = normalizeLearningRecord(getStorage().getLearningRecord());
    const week = recentActivity(record);
    const weekTotal = week.reduce((total, day) => total + day.count, 0);
    const scheduled = reviews.filter(isScheduled);
    const dueCount = scheduled.filter((item) => isDue(item)).length;
    const nextDue = scheduled
        .filter((item) => !isDue(item))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .at(0);
    const noteCount = collectNotes(records, roadmaps).length;

    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <h1>Home</h1>
                <Link className="sy-button secondary" to="/scout">
                    <Telescope />
                    New learning goal
                </Link>
            </header>
            <div className="sy-home-grid">
                <div className="sy-home-main">
                    <section className="sy-box">
                        <div className="sy-section-head">
                            <h2>Continue learning</h2>
                            {recentRoadmap && <span>Last studied</span>}
                        </div>
                        {resumeTask && resumeRoadmap ? (
                            <>
                                <article
                                    className="sy-resume"
                                    style={topicStyle(resumeRoadmap.id)}
                                >
                                    <Link
                                        className="sy-resume-media"
                                        to="/learn"
                                        search={{
                                            roadmap: resumeRoadmap.id,
                                            task: resumeTask.task.id,
                                        }}
                                        aria-label={`Continue ${resumeTask.task.title}`}
                                    >
                                        {youtubeId ? (
                                            <img
                                                src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
                                                alt=""
                                            />
                                        ) : (
                                            <BookOpen size={32} />
                                        )}
                                        {video && (
                                            <span className="sy-play">
                                                <Play />
                                            </span>
                                        )}
                                    </Link>
                                    <div className="sy-resume-copy">
                                        <p className="sy-resume-topic">
                                            <span className="sy-topic-dot" />
                                            {resumeRoadmap.title}
                                            {levelUp && (
                                                <span
                                                    className="sy-badge"
                                                    data-tone="accent"
                                                >
                                                    Level up:{" "}
                                                    {LEVEL_LABEL[levelUp.to]}
                                                </span>
                                            )}
                                        </p>
                                        <h2>
                                            {resumeTask.task.title ||
                                                resumeTask.task.text}
                                        </h2>
                                        <p>
                                            {resumeLevel
                                                ? `${LEVEL_LABEL[resumeLevel.level]} · core ${resumeLevel.coreDone + 1} of ${resumeLevel.coreTotal}`
                                                : resumeTask.sectionTitle}
                                            {video && seconds > 0 && (
                                                <>
                                                    {" · resume at "}
                                                    <span className="sy-num">
                                                        {formatTimestamp(
                                                            seconds,
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                        <Link
                                            className="sy-button primary"
                                            to="/learn"
                                            search={{
                                                roadmap: resumeRoadmap.id,
                                                task: resumeTask.task.id,
                                            }}
                                        >
                                            Resume{" "}
                                            {video ? "lesson" : "learning"}
                                            <ArrowRight />
                                        </Link>
                                    </div>
                                </article>
                                {(resumeTask.task.description ||
                                    resumeTask.task.estimatedTime) && (
                                    <p className="sy-next-label">
                                        {resumeTask.task.description ||
                                            resumeTask.task.estimatedTime}
                                    </p>
                                )}
                            </>
                        ) : roadmaps.length > 0 ? (
                            <div className="sy-tray sy-empty-row">
                                <p>Every core video is watched.</p>
                                {lastRoadmap && (
                                    <Link
                                        className="sy-button secondary"
                                        to="/learn"
                                        search={{ roadmap: lastRoadmap.id }}
                                    >
                                        Go deeper
                                        <ArrowRight />
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <ol className="sy-starters">
                                {STARTERS.map(
                                    ({ to, icon: Icon, title, body }, index) => (
                                        <li key={to}>
                                            <Link to={to} className="sy-starter">
                                                <span className="sy-starter-knob">
                                                    <Icon size={18} />
                                                </span>
                                                <span className="sy-starter-step sy-num">
                                                    {index + 1}
                                                </span>
                                                <b>{title}</b>
                                                <small>{body}</small>
                                            </Link>
                                        </li>
                                    ),
                                )}
                            </ol>
                        )}
                    </section>
                    <section className="sy-box flush sy-home-topics">
                        <div className="sy-section-head">
                            <h2>Your learning topics</h2>
                            <Link to="/workspaces">
                                View all
                                <ArrowRight size={13} />
                            </Link>
                        </div>
                        {roadmaps.length ? (
                            roadmaps.slice(0, 5).map((roadmap) => {
                                const topicLadder = getLadder(roadmap);
                                const currentLevel = topicLadder.levels.find(
                                    (level) => level.level === topicLadder.current,
                                );
                                const done = currentLevel
                                    ? currentLevel.coreDone
                                    : topicLadder.levels.reduce(
                                          (total, level) => total + level.coreDone,
                                          0,
                                      );
                                const total = currentLevel
                                    ? currentLevel.coreTotal
                                    : topicLadder.levels.reduce(
                                          (total, level) => total + level.coreTotal,
                                          0,
                                      );
                                return (
                                    <article
                                        className="sy-topic sy-spined"
                                        key={roadmap.id}
                                        style={topicStyle(roadmap.id)}
                                    >
                                        <div>
                                            <h3>
                                                <Link
                                                    to="/learn"
                                                    search={{
                                                        roadmap: roadmap.id,
                                                    }}
                                                >
                                                    {roadmap.title}
                                                </Link>
                                            </h3>
                                            <p>
                                                {currentLevel
                                                    ? `${LEVEL_LABEL[currentLevel.level]} · ${currentLevel.coreDone}/${currentLevel.coreTotal} core`
                                                    : topicLadder.levels.length
                                                      ? "Ladder complete"
                                                      : "Ready to explore"}
                                            </p>
                                            <div
                                                className="sy-progress topic"
                                                role="progressbar"
                                                aria-label={`${roadmap.title} progress`}
                                                aria-valuenow={done}
                                                aria-valuemin={0}
                                                aria-valuemax={Math.max(
                                                    1,
                                                    total,
                                                )}
                                            >
                                                <span
                                                    style={{
                                                        width: `${total ? (done / total) * 100 : 0}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="sy-readout">
                                                {done}/{total}
                                            </span>
                                            <Link
                                                className="sy-button icon"
                                                to="/learn"
                                                search={{ roadmap: roadmap.id }}
                                                aria-label={`Open ${roadmap.title}`}
                                            >
                                                <ArrowRight />
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })
                        ) : (
                            <p className="sy-tray">
                                Topics you start appear here, each with its own
                                colour.
                            </p>
                        )}
                    </section>
                </div>
                <aside className="sy-home-aside">
                    <section className="sy-box">
                        <div className="sy-section-head">
                            <h2>This week</h2>
                            <Link to="/progress">
                                Progress
                                <ArrowRight size={13} />
                            </Link>
                        </div>
                        <div className="sy-gauges">
                            <div>
                                <b className="sy-num">{record.currentStreak}</b>
                                <span>Day streak</span>
                            </div>
                            <div>
                                <b className="sy-num">{weekTotal}</b>
                                <span>Lessons</span>
                            </div>
                            <Link to="/notes">
                                <b className="sy-num">{noteCount}</b>
                                <span>Notes</span>
                            </Link>
                        </div>
                        <ol
                            className="sy-week-leds"
                            aria-label="Lessons finished on each of the last 7 days"
                        >
                            {week.map((day) => (
                                <li
                                    key={day.date}
                                    title={`${day.weekday}: ${day.count}`}
                                >
                                    <span
                                        className="sy-led"
                                        data-on={day.count > 0 || undefined}
                                    />
                                    <span>{day.weekday.charAt(0)}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                    <section className="sy-box">
                        <div className="sy-section-head">
                            <h2>Reviews</h2>
                            <Link to="/glossary">
                                Glossary
                                <ArrowRight size={13} />
                            </Link>
                        </div>
                        <div className="sy-deck-row">
                            <Link
                                className="sy-deck"
                                to="/reviews"
                                data-due={dueCount > 0 || undefined}
                                aria-label={`${dueCount} review cards ready`}
                            >
                                <b className="sy-num">{dueCount}</b>
                            </Link>
                            <div>
                                <h3>
                                    {dueCount === 1
                                        ? "card ready"
                                        : "cards ready"}
                                </h3>
                                <p>
                                    {dueCount > 0
                                        ? `${scheduled.length} in your deck`
                                        : nextDue
                                          ? `Next in ${formatInterval(nextDue.dueAt)}`
                                          : "Keep a concept to start a deck"}
                                </p>
                            </div>
                            <Link
                                className={`sy-button ${dueCount > 0 ? "primary" : "secondary"}`}
                                to="/reviews"
                            >
                                Review
                            </Link>
                        </div>
                    </section>
                    <section className="sy-box">
                        <div className="sy-section-head">
                            <h2>Currently reading</h2>
                            <Link to="/library">
                                Library
                                <ArrowRight size={13} />
                            </Link>
                        </div>
                        <div className="sy-current-books">
                            {books.length ? (
                                books.map((book) => (
                                    <article
                                        key={book.id}
                                        className="sy-current-book"
                                    >
                                        <Link
                                            to="/read/$id"
                                            params={{ id: book.id }}
                                            aria-label={`Read ${book.title}`}
                                        >
                                            <BookCover book={book} />
                                        </Link>
                                        <div>
                                            <h3>{book.title}</h3>
                                            <p>{book.chapter}</p>
                                            <div className="sy-progress">
                                                <span
                                                    style={{
                                                        width: `${book.percent}%`,
                                                    }}
                                                />
                                            </div>
                                            <Link
                                                className="sy-button quiet"
                                                to="/read/$id"
                                                params={{ id: book.id }}
                                            >
                                                Continue reading
                                                <ArrowRight />
                                            </Link>
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <div className="sy-tray sy-empty-row">
                                    <p>No book open.</p>
                                    <Link
                                        className="sy-button secondary"
                                        to="/library"
                                    >
                                        Open Library
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
