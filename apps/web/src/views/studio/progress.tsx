import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import ListSkeleton from "@/components/shared/ListSkeleton";
import { useReviews } from "@/hooks/useReviews";
import { getLadder, LEVEL_LABEL } from "@/lib/ladder";
import {
    normalizeLearningRecord,
    recentActivity,
} from "@/lib/learning-session";
import { collectNotes } from "@/lib/notes";
import { isDue, isScheduled } from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import { topicStyle } from "@/lib/topic-color";
import { getRoadmapStats } from "@/lib/workspace-stats";

/** The Learning Record at a glance: streak, the last week, and each topic. */
export default function ProgressPage() {
    const { reviews, roadmaps, records, loaded } = useReviews();
    if (!loaded)
        return (
            <div className="sy-page">
                <header className="sy-page-head">
                    <h1>Progress</h1>
                </header>
                <ListSkeleton />
            </div>
        );

    const record = normalizeLearningRecord(getStorage().getLearningRecord());
    const week = recentActivity(record);
    const weekTotal = week.reduce((total, day) => total + day.count, 0);
    const notes = collectNotes(records, roadmaps);
    const cards = reviews.filter(isScheduled);
    const dueCount = cards.filter((item) => isDue(item)).length;
    const stats = [
        {
            label: "Day streak",
            value: record.currentStreak,
            // The streak tile carries a light that is on while the streak runs.
            light: record.currentStreak > 0,
        },
        { label: "Lessons this week", value: weekTotal },
        { label: "Cards ready", value: dueCount, to: "/reviews" as const },
        { label: "Notes", value: notes.length, to: "/notes" as const },
    ];

    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <h1>Progress</h1>
            </header>

            <div className="sy-stats">
                {stats.map((stat) => {
                    const body = (
                        <>
                            <b className="sy-num">{stat.value}</b>
                            <span className="sy-stat-label">
                                {"light" in stat && (
                                    <span
                                        className="sy-led"
                                        data-on={stat.light || undefined}
                                    />
                                )}
                                {stat.label}
                            </span>
                        </>
                    );
                    return stat.to ? (
                        <Link key={stat.label} to={stat.to} className="sy-stat">
                            {body}
                        </Link>
                    ) : (
                        <div key={stat.label} className="sy-stat">
                            {body}
                        </div>
                    );
                })}
            </div>

            <section className="sy-box sy-week-box">
                <div className="sy-section-head">
                    <h2>Last 7 days</h2>
                    <span>
                        <span className="sy-num">{weekTotal}</span> lesson
                        {weekTotal === 1 ? "" : "s"}
                    </span>
                </div>
                <ol className="sy-week">
                    {week.map((day) => (
                        <li key={day.date} data-active={day.count > 0 || undefined}>
                            <span
                                className="sy-led"
                                data-on={day.count > 0 || undefined}
                            />
                            <b className="sy-num">{day.count}</b>
                            <span>{day.weekday}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="sy-box flush">
                <div className="sy-section-head">
                    <h2>Topics</h2>
                    <Link to="/workspaces">
                        View all
                        <ArrowRight size={13} />
                    </Link>
                </div>
                {roadmaps.length === 0 ? (
                    <div className="sy-tray">
                        <p>Progress appears once you start a topic.</p>
                        <Link className="sy-button secondary" to="/scout">
                            Open Scout
                            <ArrowRight />
                        </Link>
                    </div>
                ) : (
                    roadmaps.map((roadmap) => {
                        const ladder = getLadder(roadmap);
                        const stats = getRoadmapStats(roadmap);
                        const level = ladder.levels.find(
                            (entry) => entry.level === ladder.current,
                        );
                        const noteCount = notes.filter(
                            (note) => note.groupId === roadmap.id,
                        ).length;
                        const cardCount = cards.filter(
                            (item) => item.roadmapId === roadmap.id,
                        ).length;
                        return (
                            <article
                                className="sy-topic sy-row sy-spined"
                                key={roadmap.id}
                                style={topicStyle(roadmap.id)}
                            >
                                <div>
                                    <h3>
                                        <Link
                                            to="/learn"
                                            search={{ roadmap: roadmap.id }}
                                        >
                                            {roadmap.title}
                                        </Link>
                                    </h3>
                                    <p>
                                        {level ? (
                                            <>
                                                {LEVEL_LABEL[level.level]} ·{" "}
                                                <span className="sy-num">
                                                    {level.coreDone}/
                                                    {level.coreTotal}
                                                </span>{" "}
                                                core
                                            </>
                                        ) : ladder.levels.length ? (
                                            "Ladder complete"
                                        ) : (
                                            "No lessons yet"
                                        )}
                                        {" · "}
                                        <span className="sy-num">
                                            {stats.completedTasks}/
                                            {stats.totalTasks}
                                        </span>{" "}
                                        lessons
                                    </p>
                                    <div
                                        className="sy-progress topic"
                                        role="progressbar"
                                        aria-label={`${roadmap.title} progress`}
                                        aria-valuenow={stats.percent}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                    >
                                        <span
                                            style={{
                                                width: `${stats.percent}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="sy-row-actions">
                                        <Link
                                            to="/notes"
                                            search={{ roadmap: roadmap.id }}
                                        >
                                            <span className="sy-num">
                                                {noteCount}
                                            </span>{" "}
                                            note
                                            {noteCount === 1 ? "" : "s"}
                                        </Link>
                                        <Link
                                            to="/glossary"
                                            search={{ roadmap: roadmap.id }}
                                        >
                                            Glossary
                                        </Link>
                                        <span>
                                            <span className="sy-num">
                                                {cardCount}
                                            </span>{" "}
                                            card
                                            {cardCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span className="sy-topic-count sy-num">
                                        {stats.percent}%
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
                )}
            </section>
        </div>
    );
}
