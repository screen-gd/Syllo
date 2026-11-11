import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "@/components/shared/ListSkeleton";
import { Segmented } from "@/components/ui/segmented";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";
import { downloadBlob } from "@/lib/export";
import {
    collectNotes,
    createTopicNote,
    groupNotes,
    matchesNote,
    NOTE_KIND_LABEL,
    notesToMarkdown,
    updateNoteText,
    type LearnerNote,
} from "@/lib/notes";
import {
    putPersonalEntry,
    removePersonalEntry,
    usePersonalData,
} from "@/lib/personal/store";
import { formatTimestamp } from "@/lib/scout/format";
import { topicStyle } from "@/lib/topic-color";

type Scope = "all" | "lessons" | "books";
const SCOPES = [
    { key: "all", label: "All" },
    { key: "lessons", label: "Lessons" },
    { key: "books", label: "Books" },
] as const satisfies readonly { key: Scope; label: string }[];
const STORAGE_ERROR =
    "This could not be saved. Free some browser storage and try again.";

function noteDate(note: LearnerNote) {
    return new Date(note.updatedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
    });
}

/** Every note the learner has taken, searchable and grouped by topic or book. */
export default function NotesPage({ roadmapId }: { roadmapId?: string }) {
    const { roadmaps, loaded } = useLearningRoadmaps();
    const records = usePersonalData();
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<Scope>("all");
    const [groupId, setGroupId] = useState(roadmapId ?? "all");
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState("");
    const [draftTopic, setDraftTopic] = useState(roadmapId ?? "");
    const [editing, setEditing] = useState<{ id: string; text: string } | null>(
        null,
    );

    const notes = useMemo(
        () => collectNotes(records, roadmaps),
        [records, roadmaps],
    );
    const allGroups = useMemo(() => groupNotes(notes), [notes]);
    const visible = notes.filter(
        (note) =>
            (scope === "all" ||
                (scope === "books") === (note.source.kind === "book")) &&
            (groupId === "all" || note.groupId === groupId) &&
            matchesNote(note, query),
    );
    const groups = groupNotes(visible);
    const topicIds = new Set(roadmaps.map((roadmap) => roadmap.id));

    function saveDraft() {
        if (!draft.trim()) return;
        try {
            createTopicNote(draftTopic, draft);
            setDraft("");
            setComposing(false);
        } catch {
            toast.error(STORAGE_ERROR);
        }
    }

    function saveEdit() {
        if (!editing) return;
        const entry = records[editing.id];
        if (entry?.kind !== "annotation") return;
        try {
            if (editing.text.trim() || entry.data.quote)
                updateNoteText(entry, editing.text);
            setEditing(null);
        } catch {
            toast.error(STORAGE_ERROR);
        }
    }

    function remove(note: LearnerNote) {
        const entry = records[note.id];
        if (!entry) return;
        removePersonalEntry(note.id);
        toast("Note deleted", {
            action: {
                label: "Undo",
                onClick: () => putPersonalEntry({ ...entry, deleted: false }),
            },
        });
    }

    function sourceLink(note: LearnerNote) {
        if (note.source.kind === "book")
            return note.groupTitle === "Removed book" ? null : (
                <Link
                    className="sy-time-link"
                    to="/read/$id"
                    params={{ id: note.source.bookId }}
                    search={{ cfi: note.source.cfi }}
                >
                    Open passage
                    <ArrowRight size={13} />
                </Link>
            );
        if (!topicIds.has(note.source.roadmapId)) return null;
        return (
            <Link
                className="sy-time-link"
                to="/learn"
                search={{
                    roadmap: note.source.roadmapId,
                    task: note.source.taskId || undefined,
                    seconds: note.source.timed
                        ? note.source.seconds
                        : undefined,
                }}
            >
                {note.source.timed ? (
                    <>
                        Open at{" "}
                        <span className="sy-num">
                            {formatTimestamp(note.source.seconds)}
                        </span>
                    </>
                ) : note.source.taskId
                      ? "Open lesson"
                      : "Open topic"}
                <ArrowRight size={13} />
            </Link>
        );
    }

    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <div>
                    <h1>Notes</h1>
                    {loaded && (
                        <p>
                            {notes.length} note{notes.length === 1 ? "" : "s"}
                        </p>
                    )}
                </div>
                <div className="sy-head-actions">
                    <button
                        className="sy-button secondary"
                        disabled={visible.length === 0}
                        onClick={() =>
                            downloadBlob(
                                new Blob([notesToMarkdown(groups)], {
                                    type: "text/markdown",
                                }),
                                "syllo-notes.md",
                            )
                        }
                    >
                        <Download />
                        Export
                    </button>
                    <button
                        className="sy-button primary"
                        onClick={() => setComposing(true)}
                    >
                        <Plus />
                        New note
                    </button>
                </div>
            </header>

            {composing && (
                <form
                    className="sy-form sy-inline-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        saveDraft();
                    }}
                >
                    <textarea
                        className="sy-textarea"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        aria-label="Note"
                        placeholder="Write a note"
                        maxLength={6000}
                        autoFocus
                    />
                    <div className="sy-inline-form-row">
                        <select
                            className="sy-select"
                            value={draftTopic}
                            onChange={(event) =>
                                setDraftTopic(event.target.value)
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
                        <button
                            className="sy-button primary"
                            disabled={!draft.trim()}
                        >
                            Save note
                        </button>
                        <button
                            type="button"
                            className="sy-button quiet"
                            onClick={() => setComposing(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {notes.length > 0 && (
                <div className="sy-library-tools sy-toolstrip">
                    <label className="sy-search">
                        <Search />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search notes"
                            aria-label="Search notes"
                        />
                    </label>
                    <div className="sy-filters">
                        <Segmented
                            label="Note source"
                            value={scope}
                            options={SCOPES}
                            onChange={setScope}
                        />
                        <select
                            className="sy-select"
                            value={groupId}
                            onChange={(event) => setGroupId(event.target.value)}
                            aria-label="Topic or book"
                        >
                            <option value="all">Everything</option>
                            {allGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {!loaded ? (
                <ListSkeleton />
            ) : notes.length === 0 ? (
                <div className="sy-tray">
                    <p>
                        Notes you take in a lesson or highlight in a book are
                        collected here.
                    </p>
                    <Link className="sy-button secondary" to="/workspaces">
                        Open a lesson
                        <ArrowRight />
                    </Link>
                </div>
            ) : groups.length === 0 ? (
                <p className="sy-tray">No note matches this search.</p>
            ) : (
                groups.map((group) => (
                    <section
                        key={group.id}
                        className="sy-box flush sy-note-group"
                        style={
                            group.kind === "general"
                                ? undefined
                                : topicStyle(group.id)
                        }
                    >
                        <div className="sy-section-head">
                            <h2 className="sy-box-title">
                                <span className="sy-topic-dot" />
                                {group.title}
                            </h2>
                            <span className="sy-readout">
                                {group.notes.length}
                            </span>
                        </div>
                        {group.notes.map((note) => (
                            <article
                                key={note.id}
                                className="sy-saved-note sy-row"
                            >
                                <div className="sy-note-meta">
                                    {note.sourceTitle && (
                                        <b>{note.sourceTitle}</b>
                                    )}
                                    {note.kind !== "note" && (
                                        <span className="sy-badge">
                                            {NOTE_KIND_LABEL[note.kind]}
                                        </span>
                                    )}
                                    <span className="sy-num">
                                        {noteDate(note)}
                                    </span>
                                </div>
                                {note.quote && (
                                    <blockquote>{note.quote}</blockquote>
                                )}
                                {editing?.id === note.id ? (
                                    <form
                                        className="sy-form sy-inline-form"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            saveEdit();
                                        }}
                                    >
                                        <textarea
                                            className="sy-textarea"
                                            value={editing.text}
                                            onChange={(event) =>
                                                setEditing({
                                                    id: note.id,
                                                    text: event.target.value,
                                                })
                                            }
                                            aria-label="Edit note"
                                            maxLength={6000}
                                            autoFocus
                                        />
                                        <div className="sy-inline-form-row">
                                            <button className="sy-button primary">
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                className="sy-button quiet"
                                                onClick={() => setEditing(null)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        {note.text && <p>{note.text}</p>}
                                        <div className="sy-row-actions">
                                            {sourceLink(note)}
                                            <button
                                                onClick={() =>
                                                    setEditing({
                                                        id: note.id,
                                                        text: note.text,
                                                    })
                                                }
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => remove(note)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </article>
                        ))}
                    </section>
                ))
            )}
        </div>
    );
}
