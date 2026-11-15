import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Icon, Add } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
    CardMeta,
    CardTitle,
} from "@/components/glaze/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Kbd } from "@/components/glaze/ui/kbd";
import { Select } from "@/components/glaze/ui/select";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import {
    Skeleton,
    SkeletonText,
} from "@/components/glaze/ui/skeleton";
import { Textarea } from "@/components/glaze/ui/textarea";
import { toast } from "@/components/glaze/ui/toast";
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
import PageFrame from "@/components/layout/PageFrame";
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
            toast.fail(STORAGE_ERROR);
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
            toast.fail(STORAGE_ERROR);
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
                <Button
                    variant="ghost"
                    size="sm"
                    render={
                        <Link
                            to="/read/$id"
                            params={{ id: item.source.bookId }}
                            search={{ cfi: item.source.cfi }}
                        />
                    }
                    nativeButton={false}
                >
                    Return to passage
                    <Icon icon={ArrowRight} />
                </Button>
            ) : null;
        if (!topics.has(item.roadmapId) || !item.source?.taskId) return null;
        return (
            <Button
                variant="ghost"
                size="sm"
                render={
                    <Link
                        to="/learn"
                        search={{
                            roadmap: item.roadmapId,
                            task: item.source?.taskId,
                            seconds: item.source?.seconds,
                        }}
                    />
                }
                nativeButton={false}
            >
                Return to source
                <Icon icon={ArrowRight} />
            </Button>
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
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                saveDraft();
            }}
        >
            <Field>
                <FieldLabel>Question</FieldLabel>
                <Input
                    value={draft.prompt}
                    onValueChange={(value) =>
                        setDraft({ ...draft, prompt: value })
                    }
                    required
                    maxLength={1000}
                    autoFocus
                />
            </Field>
            <Field>
                <FieldLabel>Answer</FieldLabel>
                <Textarea
                    value={draft.answer}
                    onValueChange={(value) =>
                        setDraft({ ...draft, answer: value })
                    }
                    limit={6000}
                    autoGrow
                    minRows={3}
                    maxRows={12}
                />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
                {!draft.id && roadmaps.length > 0 && (
                    <Select
                        native
                        aria-label="Topic"
                        className="w-full sm:w-56"
                        value={draft.roadmapId}
                        onValueChange={(value) =>
                            setDraft({ ...draft, roadmapId: value ?? "" })
                        }
                        items={[
                            { value: "", label: "No topic" },
                            ...roadmaps.map((roadmap) => ({
                                value: roadmap.id,
                                label: roadmap.title,
                            })),
                        ]}
                    />
                )}
                <Button>{draft.id ? "Save" : "Keep card"}</Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDraft(null)}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );

    return (
        <PageFrame
            title="Reviews"
            subtitle={
                loaded
                    ? `${due.length} ready · ${scheduled.length} card${scheduled.length === 1 ? "" : "s"}${reviewedToday ? ` · ${reviewedToday} reviewed today` : ""}`
                    : undefined
            }
            actions={
                <Button
                    onClick={() => {
                        setView("all");
                        setDraft({ roadmapId: "", prompt: "", answer: "" });
                    }}
                >
                    <Icon icon={Add} />
                    New card
                </Button>
            }
        >
            <>
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                        aria-label="Review view"
                        value={view}
                        onValueChange={(value) => setView(value as View)}
                    >
                        <SegmentedControlItem value="due">
                            Review {due.length}
                        </SegmentedControlItem>
                        <SegmentedControlItem value="all">
                            All cards {reviews.length}
                        </SegmentedControlItem>
                    </SegmentedControl>
                    {view === "all" && reviews.length > 0 && (
                        <Input
                            className="w-full sm:w-56"
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search cards"
                            aria-label="Search cards"
                        />
                    )}
                </div>

                {!loaded ? (
                    <section className="shell">
                        <div
                            className="panel p-3"
                            role="status"
                            aria-label="Loading"
                        >
                            <span className="sr-only">Loading</span>
                            <SkeletonText type="caption" last={0.26} />
                            <div className="mt-3">
                                <SkeletonText type="heading" last={0.64} />
                            </div>
                            <div className="mt-3">
                                <SkeletonText type="body-sm" last={0.82} />
                                <SkeletonText type="body-sm" last={0.58} />
                            </div>
                            <Skeleton className="mt-4 h-(--control) w-32 rounded-pill" />
                        </div>
                    </section>
                ) : view === "due" ? (
                    <>
                        {current ? (
                            <Card>
                                <CardContent>
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="type-label">
                                            {sourceTitle(current)}
                                        </span>
                                        {due.length > 0 ? (
                                            <span className="type-caption text-text-2">
                                                {due.length} left
                                            </span>
                                        ) : (
                                            <span className="type-caption text-text-2">
                                                {`Ahead of schedule · ${status(current).toLowerCase()}`}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="type-heading">
                                        {current.prompt}
                                    </h2>
                                    {revealed === current.id ? (
                                        <>
                                            <div className="type-body">
                                                {current.answer}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {reviewRatings.map(
                                                    (rating, index) => (
                                                        <Button
                                                            key={rating.label}
                                                            variant={
                                                                rating.label ===
                                                                "Good"
                                                                    ? "primary"
                                                                    : "secondary"
                                                            }
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
                                                            <span className="type-caption">
                                                                {formatInterval(
                                                                    scheduleReview(
                                                                        current,
                                                                        rating.value,
                                                                    ).dueAt,
                                                                    now,
                                                                )}
                                                            </span>
                                                        </Button>
                                                    ),
                                                )}
                                            </div>
                                        </>
                                    ) : null}
                                </CardContent>
                                <CardFooter>
                                    <CardMeta className="max-sm:hidden">
                                        <Kbd>Space</Kbd> shows the answer,{" "}
                                        <Kbd>1</Kbd> to <Kbd>4</Kbd> rate it
                                    </CardMeta>
                                        {sourceLink(current)}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                setView("all");
                                                setDraft({
                                                    id: current.id,
                                                    roadmapId:
                                                        current.roadmapId,
                                                    prompt: current.prompt,
                                                    answer: current.answer,
                                                });
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        {revealed !== current.id && (
                                            <Button
                                                size="sm"
                                                aria-keyshortcuts="Space"
                                                onClick={() =>
                                                    setRevealed(current.id)
                                                }
                                            >
                                                Show answer
                                            </Button>
                                        )}
                                </CardFooter>
                            </Card>
                        ) : (
                            <Empty reason="empty">
                                <EmptyHeader>
                                    <EmptyTitle>
                                        {upcoming.length > 0
                                            ? `Nothing due. Next card in ${formatInterval(upcoming[0].dueAt, now)}`
                                            : "No cards yet. Keep a concept from a lesson, a book passage or the glossary."}
                                    </EmptyTitle>
                                </EmptyHeader>
                                <EmptyContent>
                                    {upcoming.length > 0 ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() =>
                                                setAhead(
                                                    upcoming.map(
                                                        (item) => item.id,
                                                    ),
                                                )
                                            }
                                        >
                                            Review ahead
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            render={<Link to="/glossary" />}
                                            nativeButton={false}
                                        >
                                            Open Glossary
                                            <Icon icon={ArrowRight} />
                                        </Button>
                                    )}
                                </EmptyContent>
                            </Empty>
                        )}
                        {suggested.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        <h2 className="type-heading-sm">
                                            Suggested cards
                                        </h2>
                                    </CardTitle>
                                    <CardAction>
                                        <Badge count={suggested.length} />
                                    </CardAction>
                                </CardHeader>
                                <CardContent flush>
                                    {suggested.map((item) => (
                                        <article
                                            key={item.id}
                                            className="rule-row p-3"
                                        >
                                            <h3 className="type-heading-sm">
                                                {item.prompt}
                                            </h3>
                                            <p className="mt-1 type-body-sm text-text-2">
                                                {item.answer}
                                            </p>
                                            <div className="mt-2 -ms-2 flex flex-wrap gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        persist({
                                                            ...item,
                                                            status: "kept",
                                                            dueAt: new Date().toISOString(),
                                                        })
                                                    }
                                                >
                                                    Keep card
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        persist({
                                                            ...item,
                                                            status: "skipped",
                                                        })
                                                    }
                                                >
                                                    Skip
                                                </Button>
                                                {sourceLink(item)}
                                            </div>
                                        </article>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </>
                ) : (
                    <>
                        {draft && !draft.id && (
                            <section className="shell">
                                <div className="panel p-3">{form}</div>
                            </section>
                        )}
                        {reviews.length === 0 && !draft ? (
                            <Empty reason="empty">
                                <EmptyHeader>
                                    <EmptyTitle>No cards yet</EmptyTitle>
                                </EmptyHeader>
                            </Empty>
                        ) : listed.length === 0 && !draft ? (
                            <Empty variant="plain" reason="no-results">
                                <EmptyHeader>
                                    <EmptyTitle>
                                        {query ? (
                                            <>
                                                No cards match{" "}
                                                <code>{query}</code>
                                            </>
                                        ) : (
                                            "No cards match these filters"
                                        )}
                                    </EmptyTitle>
                                </EmptyHeader>
                            </Empty>
                        ) : listed.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        <h2 className="type-heading-sm">
                                            All cards
                                        </h2>
                                    </CardTitle>
                                    <CardAction>
                                        <Badge count={listed.length} />
                                    </CardAction>
                                </CardHeader>
                                <CardContent flush>
                                    {listed.map((item) =>
                                        draft?.id === item.id ? (
                                            <div
                                                key={item.id}
                                                className="rule-row p-3"
                                            >
                                                {form}
                                            </div>
                                        ) : (
                                            <article
                                                key={item.id}
                                                className="rule-row p-3"
                                            >
                                                <div className="flex flex-wrap items-baseline gap-2">
                                                    <span className="type-label">
                                                        {sourceTitle(item)}
                                                    </span>
                                                    <Badge>
                                                        {status(item)}
                                                    </Badge>
                                                </div>
                                                <h3 className="mt-2 type-heading-sm">
                                                    {item.prompt}
                                                </h3>
                                                <p className="mt-1 type-body-sm text-text-2">
                                                    {item.answer}
                                                </p>
                                                <div className="mt-2 -ms-2 flex flex-wrap gap-1">
                                                    {sourceLink(item)}
                                                    {!isScheduled(item) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                persist({
                                                                    ...item,
                                                                    status: "kept",
                                                                    dueAt: new Date().toISOString(),
                                                                })
                                                            }
                                                        >
                                                            Keep card
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setDraft({
                                                                id: item.id,
                                                                roadmapId:
                                                                    item.roadmapId,
                                                                prompt: item.prompt,
                                                                answer: item.answer,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            remove(item)
                                                        }
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </article>
                                        ),
                                    )}
                                </CardContent>
                            </Card>
                        ) : null}
                    </>
                )}
            </>
        </PageFrame>
    );
}
