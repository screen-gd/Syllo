import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Play, Telescope } from "lucide-react";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";
import { taskVideo } from "@/lib/learning";
import { getLadder, levelUpReady, LEVEL_LABEL, nextCoreItem } from "@/lib/ladder";
import { getYouTubeId, getVideoStartSeconds } from "@/lib/video-utils";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import { getStorage } from "@/lib/storage";
import { formatTimestamp } from "@/lib/scout/format";
import BookCover from "@/components/learning/BookCover";

export default function HomePage() {
    const { roadmaps, loaded } = useLearningRoadmaps();
    const records = usePersonalData();
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
    const persistedReviews = roadmaps.flatMap((roadmap) =>
        getStorage().getReviews(roadmap.id),
    );
    const personalReviews = personalEntries(records, "review").map(
        (item) => item.data,
    );
    const reviews = [
        ...new Map(
            [...persistedReviews, ...personalReviews].map((item) => [
                item.id,
                item,
            ]),
        ).values(),
    ];
    const dueCount = reviews.filter(
        (item) =>
            item.status !== "suggested" &&
            item.status !== "skipped" &&
            new Date(item.dueAt).getTime() <= Date.now(),
    ).length;
    if (!loaded)
        return (
            <div className="sy-page sy-loading">
                Loading your learning space…
            </div>
        );

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
                    <section>
                        <div className="sy-section-head">
                            <h2>Continue learning</h2>
                            {recentRoadmap && <span>Last studied</span>}
                        </div>
                        {resumeTask && resumeRoadmap ? (
                            <>
                                <article className="sy-resume">
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
                                        <p>
                                            {levelUp
                                                ? `Level up: ${LEVEL_LABEL[levelUp.to]} · `
                                                : ""}
                                            {resumeRoadmap.title}
                                        </p>
                                        <h2>
                                            {resumeTask.task.title ||
                                                resumeTask.task.text}
                                        </h2>
                                        <p>
                                            {resumeLevel
                                                ? `${LEVEL_LABEL[resumeLevel.level]} · core ${resumeLevel.coreDone + 1} of ${resumeLevel.coreTotal}`
                                                : resumeTask.sectionTitle}
                                            {video && seconds > 0
                                                ? ` · resume at ${formatTimestamp(seconds)}`
                                                : ""}
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
                                <p className="sy-next-label">
                                    {resumeTask.task.description ||
                                        resumeTask.task.estimatedTime ||
                                        "Continue at your own pace."}
                                </p>
                            </>
                        ) : (
                            <div className="sy-empty bordered">
                                <p>
                                    {roadmaps.length
                                        ? "You’ve watched every core video. Go deeper or pick a new goal."
                                        : "Start with something you want to learn. Scout can help find and organize the resources."}
                                </p>
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
                                <Link className="sy-button primary" to="/scout">
                                    Choose a learning goal
                                    <ArrowRight />
                                </Link>
                            </div>
                        )}
                    </section>
                    <section className="sy-section">
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
                                        className="sy-topic"
                                        key={roadmap.id}
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
                                                className="sy-progress"
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
                                            <span className="sy-topic-count">
                                                {done} / {total}
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
                            <p className="sy-empty">
                                Your learning topics will appear here.
                            </p>
                        )}
                    </section>
                </div>
                <aside className="sy-home-aside">
                    <section>
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
                                <div className="sy-empty">
                                    <p>Import an EPUB to start reading.</p>
                                    <Link
                                        className="sy-button quiet"
                                        to="/library"
                                    >
                                        Open Library
                                        <ArrowRight />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>
                    <div className="sy-review-row">
                        <div>
                            <h3>
                                {dueCount} review card
                                {dueCount === 1 ? "" : "s"} ready
                            </h3>
                            <p>From concepts you chose to keep.</p>
                        </div>
                        <Link className="sy-button quiet" to="/reviews">
                            Review
                            <ArrowRight />
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}
