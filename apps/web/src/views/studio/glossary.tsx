import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Icon, Add } from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import { Card, CardContent } from "@/components/glaze/ui/card";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/glaze/ui/select";
import { SkeletonSwap,
    SkeletonText,
} from "@/components/glaze/ui/skeleton";
import { Textarea } from "@/components/glaze/ui/textarea";
import { toast } from "@/components/glaze/ui/toast";
import { useReviews } from "@/hooks/useReviews";
import {
    collectGlossary,
    glossaryReviewId,
    matchesTerm,
    removeGlossaryTerm,
    upsertGlossaryTerm,
    type GlossaryEntry,
} from "@/lib/glossary";
import { saveReview } from "@/lib/reviews";
import { getStorage } from "@/lib/storage";
import PageFrame from "@/components/layout/PageFrame";

const STORAGE_ERROR =
    "This could not be saved. Free some browser storage and try again.";

interface TermDraft {
    /** Set while editing an existing term. */
    id?: string;
    roadmapId: string;
    term: string;
    definition: string;
}

/** Every term across the learner's roadmaps, with search, editing and review cards. */
export default function GlossaryPage({ roadmapId }: { roadmapId?: string }) {
    const { reviews, roadmaps, loaded } = useReviews();
    const [query, setQuery] = useState("");
    const [topic, setTopic] = useState(roadmapId ?? "all");
    const [draft, setDraft] = useState<TermDraft | null>(null);

    const entries = useMemo(() => collectGlossary(roadmaps), [roadmaps]);
    const roadmapItems = roadmaps.map((roadmap) => ({
        value: roadmap.id,
        label: roadmap.title,
    }));
    const topicItems = [
        { value: "all", label: "All topics" },
        ...roadmapItems,
    ];
    const visible = entries.filter(
        (entry) =>
            (topic === "all" || entry.roadmapId === topic) &&
            matchesTerm(entry, query),
    );
    const carded = new Set(reviews.map((item) => item.id));
    const uncarded = visible.filter(
        (entry) =>
            !carded.has(glossaryReviewId(entry.roadmapId, entry.term.id)),
    );
    const letters = new Map<string, GlossaryEntry[]>();
    for (const entry of visible) {
        const first = entry.term.term.trim().charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(first) ? first : "#";
        letters.set(letter, [...(letters.get(letter) ?? []), entry]);
    }

    function saveDraft() {
        if (!draft?.term.trim() || !draft.definition.trim()) return;
        const roadmap = roadmaps.find((item) => item.id === draft.roadmapId);
        if (!roadmap) return;
        const cardId = draft.id && glossaryReviewId(roadmap.id, draft.id);
        const card = cardId && reviews.find((item) => item.id === cardId);
        try {
            getStorage().saveRoadmap(upsertGlossaryTerm(roadmap, draft));
        } catch {
            toast.fail(STORAGE_ERROR);
            return;
        }
        try {
            if (card)
                saveReview({
                    ...card,
                    prompt: draft.term.trim(),
                    answer: draft.definition.trim(),
                });
            setDraft(null);
        } catch {
            // Keep the term and its card in step: undo the term edit.
            try {
                getStorage().saveRoadmap(roadmap);
            } catch {
                // The rollback is no larger than the edit, so this is unlikely.
            }
            toast.fail(STORAGE_ERROR);
        }
    }

    function remove(entry: GlossaryEntry) {
        const roadmap = roadmaps.find((item) => item.id === entry.roadmapId);
        if (!roadmap) return;
        getStorage().saveRoadmap(removeGlossaryTerm(roadmap, entry.term.id));
        toast("Term deleted", {
            action: {
                label: "Undo",
                onClick: () => {
                    const current = getStorage().getRoadmap(roadmap.id);
                    if (current)
                        getStorage().saveRoadmap(
                            upsertGlossaryTerm(current, entry.term),
                        );
                },
            },
        });
    }

    function addCards(targets: readonly GlossaryEntry[]) {
        try {
            for (const entry of targets)
                saveReview({
                    id: glossaryReviewId(entry.roadmapId, entry.term.id),
                    roadmapId: entry.roadmapId,
                    prompt: entry.term.term,
                    answer: entry.term.definition,
                    status: "kept",
                    dueAt: new Date().toISOString(),
                    easeFactor: 2.5,
                    repetitions: 0,
                    intervalDays: 0,
                });
            toast(
                targets.length === 1
                    ? "Card added to Reviews"
                    : `${targets.length} cards added to Reviews`,
            );
        } catch {
            toast.fail(STORAGE_ERROR);
        }
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
                <FieldLabel>Term</FieldLabel>
                <Input
                    value={draft.term}
                    onValueChange={(value) =>
                        setDraft({ ...draft, term: value })
                    }
                    required
                    maxLength={200}
                    autoFocus
                />
            </Field>
            <Field>
                <FieldLabel>Definition</FieldLabel>
                <Textarea
                    value={draft.definition}
                    onValueChange={(value) =>
                        setDraft({ ...draft, definition: value })
                    }
                    limit={4000}
                    autoGrow
                    minRows={2}
                    maxRows={10}
                />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
                {!draft.id && (
                    <Select
                        value={draft.roadmapId}
                        onValueChange={(value) =>
                            setDraft({
                                ...draft,
                                roadmapId: value ?? draft.roadmapId,
                            })
                        }
                        items={roadmapItems}
                    >
                        <SelectTrigger
                            aria-label="Topic"
                            className="w-full sm:w-56"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {roadmapItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Button>{draft.id ? "Save" : "Add term"}</Button>
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
            title="Glossary"
            subtitle={
                loaded
                    ? `${entries.length} term${entries.length === 1 ? "" : "s"}`
                    : undefined
            }
            actions={
                <>
                    {uncarded.length > 1 && (
                        <Button
                            variant="secondary"
                            onClick={() => addCards(uncarded)}
                        >
                            Add {uncarded.length} to Reviews
                        </Button>
                    )}
                    {roadmaps.length > 0 && (
                        <Button
                            onClick={() =>
                                setDraft({
                                    roadmapId:
                                        topic !== "all"
                                            ? topic
                                            : roadmaps[0].id,
                                    term: "",
                                    definition: "",
                                })
                            }
                        >
                            <Icon icon={Add} />
                            New term
                        </Button>
                    )}
                </>
            }
        >
            <>
                {draft && !draft.id && (
                    <section className="shell">
                        <div className="panel p-3">{form}</div>
                    </section>
                )}

                {entries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            className="w-full sm:w-56"
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search terms"
                            aria-label="Search terms"
                        />
                        {roadmaps.length > 1 && (
                            <Select
                                value={topic}
                                onValueChange={(value) =>
                                    setTopic(value ?? "all")
                                }
                                items={topicItems}
                            >
                                <SelectTrigger
                                    aria-label="Topic"
                                    className="w-full sm:w-56"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {topicItems.map((item) => (
                                        <SelectItem
                                            key={item.value}
                                            value={item.value}
                                        >
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                )}

                <SkeletonSwap
                    className="flex flex-col gap-4"
                    loading={!loaded}
                    label="Loading glossary"
                    fallback={
                        <>
                            <section className="shell">
                                <div className="panel p-3">
                                    <SkeletonText type="heading-sm" last={0.2} />
                                    {[0, 1, 2].map((row) => (
                                        <div key={row} className="mt-3">
                                            <SkeletonText type="body" last={0.3} />
                                            <SkeletonText type="body-sm" last={0.72} />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    }
                >
                    {!loaded ? null : roadmaps.length === 0 ? (
                    <Empty reason="empty">
                        <EmptyHeader>
                            <EmptyTitle>
                                Terms belong to a learning topic
                            </EmptyTitle>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                variant="secondary"
                                size="sm"
                                render={<Link to="/scout" />}
                                nativeButton={false}
                            >
                                Open Scout
                                <Icon icon={ArrowRight} />
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : entries.length === 0 ? (
                    <Empty reason="empty">
                        <EmptyHeader>
                            <EmptyTitle>No terms yet</EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : visible.length === 0 ? (
                    <Empty variant="plain" reason="no-results">
                        <EmptyHeader>
                            <EmptyTitle>
                                {query ? (
                                    <>
                                        No terms match <code>{query}</code>
                                    </>
                                ) : (
                                    "No terms match these filters"
                                )}
                            </EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <Card>
                        <CardContent flush>
                    {[...letters].map(([letter, group]) => (
                        <section key={letter} className="rule-row" aria-label={letter}>
                                <h2 className="px-3 pb-1 pt-3 type-label-sm text-text-2">
                                    {letter}
                                </h2>
                                <dl>
                                    {group.map((entry) => {
                                        const hasCard = carded.has(
                                            glossaryReviewId(
                                                entry.roadmapId,
                                                entry.term.id,
                                            ),
                                        );
                                        return (
                                            <div
                                                key={entry.term.id}
                                                className="rule-row p-3"
                                            >
                                                {draft?.id ===
                                                entry.term.id ? (
                                                    form
                                                ) : (
                                                    <>
                                                        <dt className="type-label">
                                                            {entry.term.term}
                                                        </dt>
                                                        <dd>
                                                            <p className="mt-1 type-body-sm text-text-2">
                                                                {
                                                                    entry.term
                                                                        .definition
                                                                }
                                                            </p>
                                                            {roadmaps.length > 1 && (
                                                                <Link
                                                                    className="mt-1 inline-block type-caption text-text-2 transition-colors duration-(--dur-state) ease-out hover:text-text-1"
                                                                    to="/learn"
                                                                    search={{
                                                                        roadmap: entry.roadmapId,
                                                                    }}
                                                                >
                                                                    {entry.roadmapTitle}
                                                                </Link>
                                                            )}
                                                            <div className="mt-2 -ms-2 flex flex-wrap items-center gap-1">
                                                                {hasCard ? (
                                                                    <Badge>
                                                                        In
                                                                        Reviews
                                                                    </Badge>
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            addCards(
                                                                                [
                                                                                    entry,
                                                                                ],
                                                                            )
                                                                        }
                                                                    >
                                                                        Add to
                                                                        Reviews
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setDraft(
                                                                            {
                                                                                id: entry
                                                                                    .term
                                                                                    .id,
                                                                                roadmapId:
                                                                                    entry.roadmapId,
                                                                                term: entry
                                                                                    .term
                                                                                    .term,
                                                                                definition:
                                                                                    entry
                                                                                        .term
                                                                                        .definition,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        remove(
                                                                            entry,
                                                                        )
                                                                    }
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </dd>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </dl>
                        </section>
                    ))}
                        </CardContent>
                    </Card>
                )}
                </SkeletonSwap>
            </>
        </PageFrame>
    );
}
