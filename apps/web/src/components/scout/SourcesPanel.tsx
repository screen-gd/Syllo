import { useState } from "react";
import {
    Add,
    BookOpen,
    ChevronDown,
    Icon,
    Link as LinkIcon,
    TrashCan,
} from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import { Button } from "@/components/glaze/ui/button";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Select } from "@/components/glaze/ui/select";
import { Switch } from "@/components/glaze/ui/switch";
import { Textarea } from "@/components/glaze/ui/textarea";
import CostMeter from "@/components/scout/CostMeter";
import type {
    ScoutResource,
    ScoutSettings,
    ScoutSource,
    ScoutSourceKind,
    SpendSummary,
} from "@/lib/scout/types";

interface SourcesPanelProps {
    sources: ScoutSource[];
    settings: ScoutSettings | null;
    spend: SpendSummary | null;
    books: ScoutResource[];
    onAddSource: (input: {
        kind: ScoutSourceKind;
        label?: string;
        value: string;
    }) => Promise<void>;
    onRemoveSource: (id: string) => Promise<void>;
    onToggleSource: (id: string, enabled: boolean) => Promise<void>;
    onAddBook: (title: string, chapters: string[]) => Promise<void>;
    onAddUrl: (url: string, note?: string) => Promise<void>;
    onToggleAutoCheck: (enabled: boolean) => Promise<void>;
    onPause: (paused: boolean) => Promise<void>;
}

const KIND_LABEL: Record<ScoutSourceKind, string> = {
    youtube_channel: "YouTube channel",
    creator: "Creator",
    site: "Site",
    book: "Book",
};

const ADD_KINDS: Array<{
    value: ScoutSourceKind;
    label: string;
    placeholder: string;
}> = [
    { value: "creator", label: "Creator", placeholder: "@handle or name" },
    { value: "youtube_channel", label: "Channel", placeholder: "Channel URL" },
    { value: "site", label: "Site", placeholder: "developer.mozilla.org" },
];

export default function SourcesPanel({
    sources,
    settings,
    spend,
    books,
    onAddSource,
    onRemoveSource,
    onToggleSource,
    onAddBook,
    onAddUrl,
    onToggleAutoCheck,
    onPause,
}: SourcesPanelProps) {
    const [kind, setKind] = useState<ScoutSourceKind>("creator");
    const [value, setValue] = useState("");
    const [bookTitle, setBookTitle] = useState("");
    const [chapters, setChapters] = useState("");
    const [url, setUrl] = useState("");
    const [note, setNote] = useState("");
    const [working, setWorking] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    const activeKind =
        ADD_KINDS.find((item) => item.value === kind) ?? ADD_KINDS[0];

    async function run(key: string, task: () => Promise<void>) {
        setWorking(key);
        setLocalError(null);
        try {
            await task();
        } catch (error) {
            setLocalError(
                error instanceof Error ? error.message : "That did not work.",
            );
        } finally {
            setWorking(null);
        }
    }

    return (
        <aside className="shell">
            <div className="panel flex flex-col gap-5 p-4">
                <div>
                    <h2 className="type-heading-sm">Sources & settings</h2>
                    <p className="mt-1 type-caption text-text-2">
                        Creator preferences guide Scout. Search can include any
                        free source.
                    </p>
                </div>

                <section aria-labelledby="scout-sources-heading">
                    <h3
                        id="scout-sources-heading"
                        className="type-label text-text-2"
                    >
                        Watching
                    </h3>

                    <ul className="mt-2">
                        {sources.map((source) => (
                            <li
                                key={source.id}
                                className="flex items-center gap-3 border-b border-line-faint py-2 last:border-b-0"
                            >
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={
                                            source.enabled
                                                ? "break-words type-body-sm text-text-1"
                                                : "break-words type-body-sm text-text-2"
                                        }
                                    >
                                        {source.label}
                                    </p>
                                    <p className="type-caption text-text-2">
                                        {KIND_LABEL[source.kind]}
                                    </p>
                                </div>
                                <Switch
                                    aria-label={`Watch ${source.label}`}
                                    checked={source.enabled}
                                    disabled={working !== null}
                                    onCheckedChange={(checked) =>
                                        run(source.id, () =>
                                            onToggleSource(source.id, checked),
                                        )
                                    }
                                />
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remove ${source.label}`}
                                    onClick={() =>
                                        run(source.id, () =>
                                            onRemoveSource(source.id),
                                        )
                                    }
                                >
                                    <Icon icon={TrashCan} />
                                </Button>
                            </li>
                        ))}
                        {sources.length === 0 ? (
                            <li className="type-caption text-text-2">
                                Nothing yet. Add a creator or a site.
                            </li>
                        ) : null}
                    </ul>

                    <div className="mt-3 flex items-center gap-2">
                        <Select
                            native
                            aria-label="Source kind"
                            className="w-28"
                            value={kind}
                            onValueChange={(next) =>
                                setKind((next ?? "creator") as ScoutSourceKind)
                            }
                            items={ADD_KINDS.map((item) => ({
                                value: item.value,
                                label: item.label,
                            }))}
                        />
                        <Input
                            aria-label="Source value"
                            className="min-w-0 flex-1"
                            value={value}
                            placeholder={activeKind.placeholder}
                            onValueChange={setValue}
                        />
                        <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Add source"
                            disabled={
                                working !== null || value.trim().length === 0
                            }
                            onClick={() =>
                                run("add-source", async () => {
                                    await onAddSource({
                                        kind,
                                        value: value.trim(),
                                    });
                                    setValue("");
                                })
                            }
                        >
                            <Icon icon={Add} />
                        </Button>
                    </div>
                </section>

                <details>
                    <summary className="flex cursor-pointer items-center gap-2 type-body-sm text-text-1">
                        <Icon icon={BookOpen} />
                        Manual book task
                        <Icon icon={ChevronDown} className="ms-auto text-text-3" />
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                        {books.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                                {books.slice(0, 6).map((book) => (
                                    <li
                                        key={book.id}
                                        className="break-words type-caption text-text-2"
                                    >
                                        {book.title}
                                        {book.chapters.length > 0 ? (
                                            <span className="text-text-3">
                                                {" "}
                                                · {book.chapters.length}{" "}
                                                chapters
                                            </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="type-caption text-text-2">
                                Import EPUBs in Library to read their real
                                contents. Here you can add a title and your own
                                chapter list as manual tasks.
                            </p>
                        )}

                        <Field>
                            <FieldLabel>Book title</FieldLabel>
                            <Input
                                value={bookTitle}
                                placeholder="Refactoring UI"
                                onValueChange={setBookTitle}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>
                                Book chapters, one per line
                            </FieldLabel>
                            <Textarea
                                value={chapters}
                                placeholder={
                                    "Chapters, one per line (optional)\n1. Starting from scratch\n2. Hierarchy is everything"
                                }
                                autoGrow
                                minRows={3}
                                maxRows={8}
                            />
                        </Field>
                        <div>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={
                                    working !== null ||
                                    bookTitle.trim().length === 0
                                }
                                onClick={() =>
                                    run("add-book", async () => {
                                        const outline = chapters
                                            .split(/\r?\n/)
                                            .map((line) => line.trim())
                                            .filter(Boolean);
                                        await onAddBook(
                                            bookTitle.trim(),
                                            outline,
                                        );
                                        setBookTitle("");
                                        setChapters("");
                                    })
                                }
                            >
                                Add book
                            </Button>
                        </div>
                    </div>
                </details>

                <details>
                    <summary className="flex cursor-pointer items-center gap-2 type-body-sm text-text-1">
                        <Icon icon={LinkIcon} />
                        Add a URL
                        <Icon icon={ChevronDown} className="ms-auto text-text-3" />
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                        <Field>
                            <FieldLabel>Resource URL</FieldLabel>
                            <Input
                                value={url}
                                placeholder="https://…"
                                onValueChange={setUrl}
                            />
                        </Field>
                        <Field>
                            <FieldLabel>Note</FieldLabel>
                            <Input
                                value={note}
                                placeholder="Why save it? (optional)"
                                onValueChange={setNote}
                            />
                        </Field>
                        <div>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={
                                    working !== null ||
                                    url.trim().length === 0
                                }
                                onClick={() =>
                                    run("add-url", async () => {
                                        await onAddUrl(
                                            url.trim(),
                                            note.trim() || undefined,
                                        );
                                        setUrl("");
                                        setNote("");
                                    })
                                }
                            >
                                Save to library
                            </Button>
                        </div>
                    </div>
                </details>

                <section aria-labelledby="scout-settings-heading">
                    <h3
                        id="scout-settings-heading"
                        className="type-label text-text-2"
                    >
                        Settings
                    </h3>

                    <div className="mt-3 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="type-body-sm text-text-1">
                                    Auto-check
                                </p>
                                <p className="type-caption text-text-2">
                                    Optional creator RSS check at 3:00 AM
                                    Asia/Dubai, while your local server runs.
                                </p>
                            </div>
                            <Switch
                                aria-label="Auto-check nightly"
                                checked={settings?.autoCheck ?? false}
                                disabled={!settings || working !== null}
                                onCheckedChange={(checked) =>
                                    run("auto-check", () =>
                                        onToggleAutoCheck(checked),
                                    )
                                }
                            />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="type-body-sm text-text-1">
                                    Pause Scout
                                </p>
                                <p className="type-caption text-text-2">
                                    Stops the nightly check, keeps your
                                    library.
                                </p>
                            </div>
                            <Switch
                                aria-label="Pause Scout"
                                checked={settings?.paused ?? false}
                                disabled={!settings || working !== null}
                                onCheckedChange={(checked) =>
                                    run("pause", () => onPause(checked))
                                }
                            />
                        </div>
                    </div>
                </section>

                {spend ? (
                    <CostMeter
                        monthCents={spend.monthCents}
                        budgetCents={spend.budgetCents}
                        packCents={spend.packCents}
                    />
                ) : null}

                {localError ? <Alert status="fail">{localError}</Alert> : null}
            </div>
        </aside>
    );
}
