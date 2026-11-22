import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
    ArrowRight,
    Download,
    Icon,
    Add,
} from "@/components/glaze/icon";
import { Badge } from "@/components/glaze/ui/badge";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/glaze/ui/card";
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
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import {
    Skeleton,
    SkeletonSwap,
    SkeletonText,
} from "@/components/glaze/ui/skeleton";
import { Textarea } from "@/components/glaze/ui/textarea";
import { toast } from "@/components/glaze/ui/toast";
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
import PageFrame from "@/components/layout/PageFrame";

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
    const topicItems = [
        { value: "", label: "No topic" },
        ...roadmaps.map((roadmap) => ({
            value: roadmap.id,
            label: roadmap.title,
        })),
    ];
    const groupItems = [
        { value: "all", label: "Everything" },
        ...allGroups.map((group) => ({
            value: group.id,
            label: group.title,
        })),
    ];
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
            toast.fail(STORAGE_ERROR);
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
            toast.fail(STORAGE_ERROR);
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
                <Button
                    variant="ghost"
                    size="sm"
                    render={
                        <Link
                            to="/read/$id"
                            params={{ id: note.source.bookId }}
                            search={{ cfi: note.source.cfi }}
                        />
                    }
                    nativeButton={false}
                >
                    Open passage
                    <Icon icon={ArrowRight} />
                </Button>
            );
        if (!topicIds.has(note.source.roadmapId)) return null;
        return (
            <Button
                variant="ghost"
                size="sm"
                render={
                    <Link
                        to="/learn"
                        search={{
                            roadmap: note.source.roadmapId,
                            task: note.source.taskId || undefined,
                            seconds: note.source.timed
                                ? note.source.seconds
                                : undefined,
                        }}
                    />
                }
                nativeButton={false}
            >
                {note.source.timed
                    ? `Open at ${formatTimestamp(note.source.seconds)}`
                    : note.source.taskId
                      ? "Open lesson"
                      : "Open topic"}
                <Icon icon={ArrowRight} />
            </Button>
        );
    }

    return (
        <PageFrame
            title="Notes"
            subtitle={
                loaded
                    ? `${notes.length} note${notes.length === 1 ? "" : "s"}`
                    : undefined
            }
            actions={
                <>
                    <Button
                        variant="secondary"
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
                        <Icon icon={Download} />
                        Export
                    </Button>
                    <Button onClick={() => setComposing(true)}>
                        <Icon icon={Add} />
                        New note
                    </Button>
                </>
            }
        >
            <>
                {composing && (
                    <section className="shell">
                        <div className="panel p-3">
                            <form
                                className="flex flex-col gap-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    saveDraft();
                                }}
                            >
                                <Field>
                                    <FieldLabel>Note</FieldLabel>
                                    <Textarea
                                        value={draft}
                                        onValueChange={setDraft}
                                        placeholder="Write a note"
                                        limit={6000}
                                        autoGrow
                                        minRows={3}
                                        maxRows={12}
                                        autoFocus
                                    />
                                </Field>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Select
                                        value={draftTopic}
                                        onValueChange={(value) =>
                                            setDraftTopic(value ?? "")
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
                                    <Button disabled={!draft.trim()}>
                                        Save note
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setComposing(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </section>
                )}

                {notes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            className="w-full sm:w-56"
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search notes"
                            aria-label="Search notes"
                        />
                        <SegmentedControl
                            aria-label="Note source"
                            value={scope}
                            onValueChange={(value) => setScope(value as Scope)}
                        >
                            {SCOPES.map((item) => (
                                <SegmentedControlItem
                                    key={item.key}
                                    value={item.key}
                                >
                                    {item.label}
                                </SegmentedControlItem>
                            ))}
                        </SegmentedControl>
                        <Select
                            value={groupId}
                            onValueChange={(value) =>
                                setGroupId(value ?? "all")
                            }
                            items={groupItems}
                        >
                            <SelectTrigger
                                aria-label="Topic or book"
                                className="w-full sm:w-56"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {groupItems.map((item) => (
                                    <SelectItem
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <SkeletonSwap
                    className="flex flex-col gap-4"
                    loading={!loaded}
                    label="Loading notes"
                    fallback={
                        <>
                            <section className="shell">
                                <div className="panel p-3">
                                    <SkeletonText type="heading-sm" last={0.3} />
                                    {[0, 1, 2].map((row) => (
                                        <div key={row} className="mt-3">
                                            <SkeletonText type="body" last={0.36} />
                                            <SkeletonText type="body-sm" last={0.74} />
                                        </div>
                                    ))}
                                    <Skeleton className="mt-3 h-4 w-24" />
                                </div>
                            </section>
                        </>
                    }
                >
                    {!loaded ? null : notes.length === 0 ? (
                    <Empty reason="empty">
                        <EmptyHeader>
                            <EmptyTitle>No notes yet</EmptyTitle>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                variant="secondary"
                                size="sm"
                                render={<Link to="/workspaces" />}
                                nativeButton={false}
                            >
                                Open a lesson
                                <Icon icon={ArrowRight} />
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : groups.length === 0 ? (
                    <Empty variant="plain" reason="no-results">
                        <EmptyHeader>
                            <EmptyTitle>
                                {query ? (
                                    <>
                                        No notes match <code>{query}</code>
                                    </>
                                ) : (
                                    "No notes match these filters"
                                )}
                            </EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    groups.map((group) => (
                        <Card key={group.id}>
                            <CardHeader>
                                <CardTitle>
                                    <h2 className="type-heading-sm">
                                        {group.title}
                                    </h2>
                                </CardTitle>
                                <CardAction>
                                    <Badge count={group.notes.length} />
                                </CardAction>
                            </CardHeader>
                            <CardContent flush>
                                {group.notes.map((note) => (
                                    <article
                                        key={note.id}
                                        className="rule-row p-3"
                                    >
                                        <div className="flex flex-wrap items-baseline gap-2">
                                            {note.sourceTitle && (
                                                <span className="type-label">
                                                    {note.sourceTitle}
                                                </span>
                                            )}
                                            {note.kind !== "note" && (
                                                <Badge>
                                                    {NOTE_KIND_LABEL[note.kind]}
                                                </Badge>
                                            )}
                                            <span className="type-caption text-text-2">
                                                {noteDate(note)}
                                            </span>
                                        </div>
                                        {note.quote && (
                                            <blockquote className="well mt-2 rounded-tag px-3 py-2 type-body-sm text-text-2">
                                                {note.quote}
                                            </blockquote>
                                        )}
                                        {editing?.id === note.id ? (
                                            <form
                                                className="mt-2 flex flex-col gap-3"
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    saveEdit();
                                                }}
                                            >
                                                <Field>
                                                    <FieldLabel>
                                                        Edit note
                                                    </FieldLabel>
                                                    <Textarea
                                                        value={editing.text}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            setEditing({
                                                                id: note.id,
                                                                text: value,
                                                            })
                                                        }
                                                        limit={6000}
                                                        autoGrow
                                                        minRows={3}
                                                        maxRows={12}
                                                        autoFocus
                                                    />
                                                </Field>
                                                <div className="flex gap-2">
                                                    <Button size="sm">
                                                        Save
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setEditing(null)
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </form>
                                        ) : (
                                            <>
                                                {note.text && (
                                                    <p className="mt-2 type-body-sm">
                                                        {note.text}
                                                    </p>
                                                )}
                                                <div className="mt-2 -ms-2 flex gap-1">
                                                    {sourceLink(note)}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setEditing({
                                                                id: note.id,
                                                                text: note.text,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            remove(note)
                                                        }
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </article>
                                ))}
                            </CardContent>
                        </Card>
                    ))
                )}
                </SkeletonSwap>
            </>
        </PageFrame>
    );
}
