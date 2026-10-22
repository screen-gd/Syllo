import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";
import { getStorage } from "@/lib/storage";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import { reviewRatings, saveReview, scheduleReview } from "@/lib/reviews";
import type { SrsItem } from "@/types";

export default function ReviewsPage() {
    const { roadmaps, loaded } = useLearningRoadmaps();
    const records = usePersonalData();
    const [revealed, setRevealed] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const local = roadmaps.flatMap((roadmap) =>
        getStorage().getReviews(roadmap.id),
    );
    const personal = personalEntries(records, "review").map(
        (entry) => entry.data,
    );
    const items = [
        ...new Map(
            [...local, ...personal].map((item) => [item.id, item]),
        ).values(),
    ];
    const due = items
        .filter(
            (item) =>
                item.status !== "suggested" &&
                item.status !== "skipped" &&
                new Date(item.dueAt).getTime() <= Date.now(),
        )
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const suggested = items.filter((item) => item.status === "suggested");
    const current = due[0];
    const next = items
        .filter(
            (item) =>
                item.status !== "suggested" &&
                item.status !== "skipped" &&
                new Date(item.dueAt).getTime() > Date.now(),
        )
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    function persist(item: SrsItem) {
        try {
            saveReview(item);
            setError(null);
            setRevealed(null);
        } catch {
            setError(
                "This review could not be saved. Your existing schedule is unchanged.",
            );
        }
    }
    function sourceLink(item: SrsItem) {
        if (item.source?.bookId)
            return (
                <Link
                    className="sy-button quiet"
                    to="/read/$id"
                    params={{ id: item.source.bookId }}
                    search={{ cfi: item.source.cfi }}
                >
                    Return to passage
                    <ArrowRight />
                </Link>
            );
        return (
            <Link
                className="sy-button quiet"
                to="/learn"
                search={{
                    roadmap: item.roadmapId,
                    task: item.source?.taskId,
                    seconds: item.source?.seconds,
                }}
            >
                Return to source
                <ArrowRight />
            </Link>
        );
    }
    if (!loaded)
        return <div className="sy-page sy-loading">Loading reviews…</div>;
    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <div>
                    <h1>Reviews</h1>
                    <p>
                        {due.length} card{due.length === 1 ? "" : "s"} ready
                        {suggested.length
                            ? ` · ${suggested.length} suggested`
                            : ""}
                    </p>
                </div>
            </header>
            {error && (
                <p className="sy-error" role="alert">
                    {error}
                </p>
            )}
            {current ? (
                <article className="sy-card">
                    <p
                        className="sy-muted sy-small"
                        style={{ marginBottom: 14 }}
                    >
                        {roadmaps.find(
                            (roadmap) => roadmap.id === current.roadmapId,
                        )?.title || "Reading"}
                    </p>
                    <h2>{current.prompt}</h2>
                    {revealed === current.id ? (
                        <>
                            <div className="sy-card-answer">
                                {current.answer}
                            </div>
                            <div className="sy-card-actions">
                                {reviewRatings.map((rating) => (
                                    <button
                                        key={rating.label}
                                        className={`sy-button ${rating.label === "Good" ? "primary" : "secondary"}`}
                                        onClick={() =>
                                            persist(
                                                scheduleReview(
                                                    current,
                                                    rating.value,
                                                ),
                                            )
                                        }
                                    >
                                        {rating.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <button
                            className="sy-button primary"
                            onClick={() => setRevealed(current.id)}
                        >
                            Show answer
                        </button>
                    )}
                    {sourceLink(current)}
                </article>
            ) : (
                <div className="sy-empty">
                    <h2>Nothing due right now.</h2>
                    <p>
                        {next
                            ? `Next review: ${new Date(next.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
                            : "Keep useful concepts from a lesson or a passage to review them here."}
                    </p>
                    <Link className="sy-button quiet" to="/dashboard">
                        Back to Home
                        <ArrowRight />
                    </Link>
                </div>
            )}
            {suggested.length > 0 && (
                <section className="sy-section">
                    <h2>Suggested cards</h2>
                    <p className="sy-muted sy-small" style={{ marginTop: 8 }}>
                        Keep the concepts you want to remember. Skipping a
                        suggestion adds no review work.
                    </p>
                    {suggested.map((item) => (
                        <article key={item.id} className="sy-suggestion">
                            <h3>{item.prompt}</h3>
                            <p>{item.answer}</p>
                            <div className="sy-suggestion-actions">
                                <button
                                    className="sy-button secondary"
                                    onClick={() =>
                                        persist({
                                            ...item,
                                            status: "kept",
                                            dueAt: new Date().toISOString(),
                                        })
                                    }
                                >
                                    Keep card
                                </button>
                                <button
                                    className="sy-button quiet"
                                    onClick={() =>
                                        persist({ ...item, status: "skipped" })
                                    }
                                >
                                    Skip
                                </button>
                                {sourceLink(item)}
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </div>
    );
}
