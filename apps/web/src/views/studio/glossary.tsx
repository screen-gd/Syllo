import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "@/components/shared/ListSkeleton";
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
import { topicStyle } from "@/lib/topic-color";

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
            toast.error(STORAGE_ERROR);
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
            toast.error(STORAGE_ERROR);
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
            toast.error(STORAGE_ERROR);
        }
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
                Term
                <input
                    className="sy-input"
                    value={draft.term}
                    onChange={(event) =>
                        setDraft({ ...draft, term: event.target.value })
                    }
                    required
                    maxLength={200}
                    autoFocus
                />
            </label>
            <label>
                Definition
                <textarea
                    className="sy-textarea"
                    value={draft.definition}
                    onChange={(event) =>
                        setDraft({ ...draft, definition: event.target.value })
                    }
                    required
                    maxLength={4000}
                />
            </label>
            <div className="sy-inline-form-row">
                {!draft.id && (
                    <select
                        className="sy-select"
                        value={draft.roadmapId}
                        onChange={(event) =>
                            setDraft({ ...draft, roadmapId: event.target.value })
                        }
                        aria-label="Topic"
                    >
                        {roadmaps.map((roadmap) => (
                            <option key={roadmap.id} value={roadmap.id}>
                                {roadmap.title}
                            </option>
                        ))}
                    </select>
                )}
                <button className="sy-button primary">
                    {draft.id ? "Save" : "Add term"}
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
                    <h1>Glossary</h1>
                    {loaded && (
                        <p>
                            {entries.length} term
                            {entries.length === 1 ? "" : "s"}
                        </p>
                    )}
                </div>
                <div className="sy-head-actions">
                    {uncarded.length > 1 && (
                        <button
                            className="sy-button secondary"
                            onClick={() => addCards(uncarded)}
                        >
                            Add {uncarded.length} to Reviews
                        </button>
                    )}
                    {roadmaps.length > 0 && (
                        <button
                            className="sy-button primary"
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
                            <Plus />
                            New term
                        </button>
                    )}
                </div>
            </header>

            {draft && !draft.id && form}

            {entries.length > 0 && (
                <div className="sy-library-tools sy-toolstrip">
                    <label className="sy-search">
                        <Search />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search terms"
                            aria-label="Search terms"
                        />
                    </label>
                    {roadmaps.length > 1 && (
                        <div className="sy-filters">
                            <select
                                className="sy-select"
                                value={topic}
                                onChange={(event) =>
                                    setTopic(event.target.value)
                                }
                                aria-label="Topic"
                            >
                                <option value="all">All topics</option>
                                {roadmaps.map((roadmap) => (
                                    <option key={roadmap.id} value={roadmap.id}>
                                        {roadmap.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {!loaded ? (
                <ListSkeleton />
            ) : roadmaps.length === 0 ? (
                <div className="sy-tray">
                    <p>Terms belong to a learning topic. Start one first.</p>
                    <Link className="sy-button secondary" to="/scout">
                        Open Scout
                        <ArrowRight />
                    </Link>
                </div>
            ) : entries.length === 0 ? (
                <p className="sy-tray">
                    No terms yet. Add the words you want to remember.
                </p>
            ) : visible.length === 0 ? (
                <p className="sy-tray">No term matches this search.</p>
            ) : (
                [...letters].map(([letter, group]) => (
                    <section key={letter} className="sy-box flush sy-term-group">
                        <div className="sy-section-head">
                            <h2 className="sy-initial">{letter}</h2>
                            <span className="sy-readout">{group.length}</span>
                        </div>
                        <dl>
                            {group.map((entry) => {
                                const hasCard = carded.has(
                                    glossaryReviewId(
                                        entry.roadmapId,
                                        entry.term.id,
                                    ),
                                );
                                return draft?.id === entry.term.id ? (
                                    <div
                                        key={entry.term.id}
                                        className="sy-term sy-row"
                                    >
                                        {form}
                                    </div>
                                ) : (
                                    <div
                                        key={entry.term.id}
                                        className="sy-term sy-row"
                                    >
                                        <dt>{entry.term.term}</dt>
                                        <dd>
                                            <p>{entry.term.definition}</p>
                                            <div className="sy-row-actions">
                                                {roadmaps.length > 1 && (
                                                    <Link
                                                        className="sy-topic-link"
                                                        style={topicStyle(
                                                            entry.roadmapId,
                                                        )}
                                                        to="/learn"
                                                        search={{
                                                            roadmap:
                                                                entry.roadmapId,
                                                        }}
                                                    >
                                                        <span className="sy-topic-dot" />
                                                        {entry.roadmapTitle}
                                                    </Link>
                                                )}
                                                {hasCard ? (
                                                    <span className="sy-state">
                                                        <span
                                                            className="sy-led"
                                                            data-on
                                                        />
                                                        In Reviews
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            addCards([entry])
                                                        }
                                                    >
                                                        Add to Reviews
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        setDraft({
                                                            id: entry.term.id,
                                                            roadmapId:
                                                                entry.roadmapId,
                                                            term: entry.term
                                                                .term,
                                                            definition:
                                                                entry.term
                                                                    .definition,
                                                        })
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        remove(entry)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                    </section>
                ))
            )}
        </div>
    );
}
