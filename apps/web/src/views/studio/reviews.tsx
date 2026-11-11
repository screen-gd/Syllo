import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "@/components/shared/ListSkeleton";
import { Segmented } from "@/components/ui/segmented";
import { useReviews } from "@/hooks/useReviews";
import { personalEntries } from "@/lib/personal/store";
import {
    createReview,
    deleteReview,
    formatInterval,
    isDue,
    isScheduled,
    reviewRatings,
    saveReview,
    scheduleReview,
} from "@/lib/reviews";
import { topicStyle } from "@/lib/topic-color";
import type { SrsItem } from "@/types";

type View = "due" | "all";
interface CardDraft {
    /** Set while editing an existing card. */
    id?: string;
    roadmapId: string;
    prompt: string;
    answer: string;
}
const STORAGE_ERROR =
    "This could not be saved. Your existing schedule is unchanged.";

function isTyping(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, button, a") !== null
    );
}

/** The review queue, plus a browsable list of every card for editing. */
export default function ReviewsPage() {
    const { reviews, roadmaps, records, loaded } = useReviews();
    const [view, setView] = useState<View>("due");
    const [revealed, setRevealed] = useState<string | null>(null);
    // Cards still to see in a "review ahead" pass; null outside one.
    const [ahead, setAhead] = useState<string[] | null>(null);
    const [query, setQuery] = useState("");
    const [draft, setDraft] = useState<CardDraft | null>(null);

    const now = Date.now();
    const byDue = (a: SrsItem, b: SrsItem) => a.dueAt.localeCompare(b.dueAt);
    const scheduled = reviews.filter(isScheduled).sort(byDue);
    const due = scheduled.filter((item) => isDue(item, now));
    const upcoming = scheduled.filter((item) => !isDue(item, now));
    const suggested = reviews.filter((item) => item.status === "suggested");
    const queue =
        due.length > 0
            ? due
            : upcoming.filter((item) => ahead?.includes(item.id));
    const current = queue.at(0);
    const today = new Date().toDateString();
    const reviewedToday = reviews.filter(
        (item) =>
            item.lastReviewedAt &&
            new Date(item.lastReviewedAt).toDateString() === today,
    ).length;
    const books = new Map(
        personalEntries(records, "book").map((entry) => [
            `book:${entry.data.id}`,
            entry.data.title,
        ]),
    );
    const topics = new Map(roadmaps.map((item) => [item.id, item.title]));
    const sourceTitle = (item: SrsItem) =>
        topics.get(item.roadmapId) ?? books.get(item.roadmapId) ?? "General";
    // Cards with no topic keep the accent colour.
    const itemStyle = (item: SrsItem) =>
        item.roadmapId ? topicStyle(item.roadmapId) : undefined;
    const needle = query.trim().toLowerCase();
    const listed = [...reviews]
        .filter(
            (item) =>
                !needle ||
                item.prompt.toLowerCase().includes(needle) ||
                item.answer.toLowerCase().includes(needle),
        )
        .sort(byDue);

    function persist(item: SrsItem) {
        try {
            saveReview(item);
            setRevealed(null);
            setAhead((ids) => ids?.filter((id) => id !== item.id) ?? null);
        } catch {
            toast.error(STORAGE_ERROR);
        }
    }

    // Space or Enter shows the answer; 1 to 4 rate it. The listener is cheap,
    // so it re-subscribes each render and always sees the current card.
    useEffect(() => {
        if (view !== "due" || !current || draft) return;
        const card = current;
        function onKey(event: KeyboardEvent) {
            if (isTyping(event.target) || event.metaKey || event.ctrlKey)
                return;
            if (revealed !== card.id) {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    setRevealed(card.id);
                }
                return;
            }
            const rating = reviewRatings[Number(event.key) - 1];
            if (rating) persist(scheduleReview(card, rating.value));
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    function saveDraft() {
        if (!draft?.prompt.trim() || !draft.answer.trim()) return;
        try {
            const existing = reviews.find((item) => item.id === draft.id);
            if (existing)
                saveReview({
                    ...existing,
                    prompt: draft.prompt.trim(),
                    answer: draft.answer.trim(),
                });
            else
                createReview({
                    prompt: draft.prompt,
                    answer: draft.answer,
                    roadmapId: draft.roadmapId,
                    source: undefined,
                });
            setDraft(null);
        } catch {
            toast.error(STORAGE_ERROR);
        }
    }

    function remove(item: SrsItem) {
        deleteReview(item);
        toast("Card deleted", {
            action: { label: "Undo", onClick: () => saveReview(item) },
        });
    }

    function sourceLink(item: SrsItem) {
        if (item.source?.bookId)
            return books.has(`book:${item.source.bookId}`) ? (
                <Link
                    className="sy-time-link"
                    to="/read/$id"
                    params={{ id: item.source.bookId }}
                    search={{ cfi: item.source.cfi }}
                >
                    Return to passage
                    <ArrowRight size={13} />
                </Link>
            ) : null;
        if (!topics.has(item.roadmapId)) return null;
        return (
            <Link
                className="sy-time-link"
                to="/learn"
                search={{
                    roadmap: item.roadmapId,
                    task: item.source?.taskId,
                    seconds: item.source?.seconds,
                }}
            >
                Return to source
                <ArrowRight size={13} />
            </Link>
        );
    }

    function status(item: SrsItem) {
        if (item.status === "suggested") return "Suggested";
        if (item.status === "skipped") return "Skipped";
        return isDue(item, now)
            ? "Due now"
            : `Due in ${formatInterval(item.dueAt, now)}`;
    }

    const form = draft && (
        <form
            className="sy-form sy-inline-form"
            onSubmit={(event) => {
                event.preventDefault();
                saveDraft();
            }}
        >
            <label>
                Question
                <input
                    className="sy-input"
                    value={draft.prompt}
                    onChange={(event) =>
                        setDraft({ ...draft, prompt: event.target.value })
                    }
                    required
                    maxLength={1000}
                    autoFocus
                />
            </label>
            <label>
                Answer
                <textarea
                    className="sy-textarea"
                    value={draft.answer}
                    onChange={(event) =>
                        setDraft({ ...draft, answer: event.target.value })
                    }
                    required
                    maxLength={6000}
                />
            </label>
            <div className="sy-inline-form-row">
                {!draft.id && roadmaps.length > 0 && (
                    <select
                        className="sy-select"
                        value={draft.roadmapId}
                        onChange={(event) =>
                            setDraft({ ...draft, roadmapId: event.target.value })
                        }
                        aria-label="Topic"
                    >
                        <option value="">No topic</option>
                        {roadmaps.map((roadmap) => (
                            <option key={roadmap.id} value={roadmap.id}>
                                {roadmap.title}
                            </option>
                        ))}
                    </select>
                )}
                <button className="sy-button primary">
                    {draft.id ? "Save" : "Keep card"}
                </button>
                <button
                    type="button"
                    className="sy-button quiet"
                    onClick={() => setDraft(null)}
                >
                    Cancel
                </button>
            </div>
        </form>
    );

    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <div>
                    <h1>Reviews</h1>
                    {loaded && (
                        <p>
                            {due.length} ready · {scheduled.length} card
                            {scheduled.length === 1 ? "" : "s"}
                            {reviewedToday
                                ? ` · ${reviewedToday} reviewed today`
                                : ""}
                        </p>
                    )}
                </div>
                <button
                    className="sy-button primary"
                    onClick={() => {
                        setView("all");
                        setDraft({ roadmapId: "", prompt: "", answer: "" });
                    }}
                >
                    <Plus />
                    New card
                </button>
            </header>

            <div className="sy-library-tools sy-toolstrip">
                <Segmented
                    label="Review view"
                    value={view}
                    options={[
                        { key: "due", label: `Review ${due.length}` },
                        { key: "all", label: `All cards ${reviews.length}` },
                    ]}
                    onChange={setView}
                />
                {view === "all" && reviews.length > 0 && (
                    <label className="sy-search">
                        <Search />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search cards"
                            aria-label="Search cards"
                        />
                    </label>
                )}
            </div>

            {!loaded ? (
                <ListSkeleton rows={3} />
            ) : view === "due" ? (
                <>
                    {current ? (
                        <article
                            className="sy-card sy-review-card"
                            style={itemStyle(current)}
                        >
                            <div className="sy-note-meta">
                                <b className="sy-topic-link">
                                    <span className="sy-topic-dot" />
                                    {sourceTitle(current)}
                                </b>
                                {due.length > 0 ? (
                                    <span className="sy-review-left">
                                        <span className="sy-readout" data-live>
                                            {due.length}
                                        </span>
                                        left
                                    </span>
                                ) : (
                                    <span>
                                        {`Ahead of schedule · ${status(current).toLowerCase()}`}
                                    </span>
                                )}
                            </div>
                            <h2>{current.prompt}</h2>
                            {revealed === current.id ? (
                                <>
                                    <div className="sy-card-answer">
                                        {current.answer}
                                    </div>
                                    <div className="sy-card-actions sy-rate-row">
                                        {reviewRatings.map((rating, index) => (
                                            <button
                                                key={rating.label}
                                                className={`sy-button sy-rate ${rating.label === "Good" ? "primary" : "secondary"}`}
                                                aria-keyshortcuts={String(
                                                    index + 1,
                                                )}
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
                                                <small className="sy-num">
                                                    {formatInterval(
                                                        scheduleReview(
                                                            current,
                                                            rating.value,
                                                        ).dueAt,
                                                        now,
                                                    )}
                                                </small>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <button
                                    className="sy-button primary"
                                    aria-keyshortcuts="Space"
                                    onClick={() => setRevealed(current.id)}
                                >
                                    Show answer
                                </button>
                            )}
                            <div className="sy-row-actions">
                                {sourceLink(current)}
                                <button
                                    onClick={() => {
                                        setView("all");
                                        setDraft({
                                            id: current.id,
                                            roadmapId: current.roadmapId,
                                            prompt: current.prompt,
                                            answer: current.answer,
                                        });
                                    }}
                                >
                                    Edit
                                </button>
                                <span className="sy-key-hint">
                                    Space shows the answer, 1 to 4 rate it
                                </span>
                            </div>
                        </article>
                    ) : (
                        <div className="sy-tray">
                            <p>
                                {upcoming.length > 0
                                    ? `Nothing due. Next card in ${formatInterval(upcoming[0].dueAt, now)}.`
                                    : "No cards yet. Keep a concept from a lesson, a book passage or the glossary."}
                            </p>
                            {upcoming.length > 0 ? (
                                <button
                                    className="sy-button secondary"
                                    onClick={() =>
                                        setAhead(
                                            upcoming.map((item) => item.id),
                                        )
                                    }
                                >
                                    Review ahead
                                </button>
                            ) : (
                                <Link
                                    className="sy-button secondary"
                                    to="/glossary"
                                >
                                    Open Glossary
                                    <ArrowRight />
                                </Link>
                            )}
                        </div>
                    )}
                    {suggested.length > 0 && (
                        <section className="sy-box flush sy-review-box">
                            <div className="sy-section-head">
                                <h2>Suggested cards</h2>
                                <span className="sy-readout">
                                    {suggested.length}
                                </span>
                            </div>
                            {suggested.map((item) => (
                                <article
                                    key={item.id}
                                    className="sy-suggestion sy-row sy-spined"
                                    style={itemStyle(item)}
                                >
                                    <h3>{item.prompt}</h3>
                                    <p>{item.answer}</p>
                                    <div className="sy-row-actions">
                                        <button
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
                                            onClick={() =>
                                                persist({
                                                    ...item,
                                                    status: "skipped",
                                                })
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
                </>
            ) : (
                <>
                    {draft && !draft.id && form}
                    {reviews.length === 0 && !draft ? (
                        <p className="sy-tray">No cards yet.</p>
                    ) : listed.length === 0 && !draft ? (
                        <p className="sy-tray">No card matches this search.</p>
                    ) : listed.length > 0 ? (
                        <section className="sy-box flush sy-review-box">
                            <div className="sy-section-head">
                                <h2>All cards</h2>
                                <span className="sy-readout">
                                    {listed.length}
                                </span>
                            </div>
                            {listed.map((item) =>
                                draft?.id === item.id ? (
                                    <div
                                        key={item.id}
                                        className="sy-suggestion sy-row sy-spined"
                                        style={itemStyle(item)}
                                    >
                                        {form}
                                    </div>
                                ) : (
                                    <article
                                        key={item.id}
                                        className="sy-suggestion sy-row sy-spined"
                                        style={itemStyle(item)}
                                    >
                                        <div className="sy-note-meta">
                                            <b>{sourceTitle(item)}</b>
                                            <span
                                                className="sy-badge"
                                                data-tone={
                                                    status(item) === "Due now"
                                                        ? "accent"
                                                        : undefined
                                                }
                                            >
                                                {status(item)}
                                            </span>
                                        </div>
                                        <h3>{item.prompt}</h3>
                                        <p>{item.answer}</p>
                                        <div className="sy-row-actions">
                                            {sourceLink(item)}
                                            {!isScheduled(item) && (
                                                <button
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
                                            )}
                                            <button
                                                onClick={() =>
                                                    setDraft({
                                                        id: item.id,
                                                        roadmapId: item.roadmapId,
                                                        prompt: item.prompt,
                                                        answer: item.answer,
                                                    })
                                                }
                                            >
                                                Edit
                                            </button>
                                            <button onClick={() => remove(item)}>
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                ),
                            )}
                        </section>
                    ) : null}
                </>
            )}
        </div>
    );
}
