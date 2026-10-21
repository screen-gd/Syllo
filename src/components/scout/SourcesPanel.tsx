import { useState } from "react";
import { BookOpen, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CostMeter from "@/components/scout/CostMeter";
import { cn } from "@/lib/utils";
import type { ScoutResource, ScoutSettings, ScoutSource, ScoutSourceKind, SpendSummary } from "@/lib/scout/types";

interface SourcesPanelProps {
    sources: ScoutSource[];
    settings: ScoutSettings | null;
    spend: SpendSummary | null;
    books: ScoutResource[];
    onAddSource: (input: { kind: ScoutSourceKind; label?: string; value: string }) => Promise<void>;
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

const ADD_KINDS: Array<{ value: ScoutSourceKind; label: string; placeholder: string }> = [
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

    const activeKind = ADD_KINDS.find((item) => item.value === kind) ?? ADD_KINDS[0];

    async function run(key: string, task: () => Promise<void>) {
        setWorking(key);
        setLocalError(null);
        try {
            await task();
        } catch (error) {
            setLocalError(error instanceof Error ? error.message : "That did not work.");
        } finally {
            setWorking(null);
        }
    }

    return (
        <aside className="space-y-7 rounded-2xl bg-surface p-[22px]">
            <div>
                <h2 className="text-base text-text">Sources & settings</h2>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                    Scout watches these places. Creators and channels feed new videos; sites feed articles and docs.
                </p>
            </div>

            <section aria-labelledby="scout-sources-heading" className="space-y-3">
                <h3 id="scout-sources-heading" className="text-xs text-text-soft">
                    Watching
                </h3>

                <ul>
                    {sources.map((source) => (
                        <li key={source.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                            <div className="min-w-0 flex-1">
                                <p className={cn("truncate text-sm", source.enabled ? "text-text" : "text-text-soft")}>{source.label}</p>
                                <p className="truncate text-xs text-text-soft">
                                    {KIND_LABEL[source.kind]}
                                </p>
                            </div>
                            <Switch
                                aria-label={`Watch ${source.label}`}
                                checked={source.enabled}
                                disabled={working !== null}
                                onCheckedChange={(checked) => run(source.id, () => onToggleSource(source.id, checked))}
                            />
                            <button
                                type="button"
                                aria-label={`Remove ${source.label}`}
                                onClick={() => run(source.id, () => onRemoveSource(source.id))}
                                className="text-text-soft transition-colors hover:text-danger"
                            >
                                <Trash2 size={13} />
                            </button>
                        </li>
                    ))}
                    {sources.length === 0 ? (
                        <li className="text-xs text-text-soft">Nothing yet. Add a creator or a site.</li>
                    ) : null}
                </ul>

                <div className="flex gap-2">
                    <select
                        aria-label="Source kind"
                        value={kind}
                        onChange={(event) => setKind(event.target.value as ScoutSourceKind)}
                        className="h-9 shrink-0 rounded-[10px] border border-[#2e2e2e] bg-surface px-2 text-xs text-text focus:border-[#4a4a4a] focus:outline-none"
                    >
                        {ADD_KINDS.map((item) => (
                            <option key={item.value} value={item.value} className="bg-[#111]">
                                {item.label}
                            </option>
                        ))}
                    </select>
                    <Input
                        aria-label="Source value"
                        value={value}
                        placeholder={activeKind.placeholder}
                        onChange={(event) => setValue(event.target.value)}
                        className="h-9 text-xs"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label="Add source"
                        disabled={working !== null || value.trim().length === 0}
                        onClick={() =>
                            run("add-source", async () => {
                                await onAddSource({ kind, value: value.trim() });
                                setValue("");
                            })
                        }
                    >
                        <Plus size={14} />
                    </Button>
                </div>
            </section>

            <section aria-labelledby="scout-books-heading" className="space-y-3">
                <h3 id="scout-books-heading" className="flex items-center gap-2 text-xs text-text-soft">
                    <BookOpen size={12} /> Reading shelf
                </h3>

                {books.length > 0 ? (
                    <ul className="space-y-1">
                        {books.slice(0, 6).map((book) => (
                            <li key={book.id} className="truncate text-xs text-text-muted">
                                {book.title}
                                {book.chapters.length > 0 ? <span className="text-text-soft"> · {book.chapters.length} chapters</span> : null}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-text-soft">Add a book and its chapters become reading tasks.</p>
                )}

                <Input
                    aria-label="Book title"
                    value={bookTitle}
                    placeholder="Refactoring UI"
                    onChange={(event) => setBookTitle(event.target.value)}
                    className="h-9 text-xs"
                />
                <Textarea
                    aria-label="Book chapters, one per line"
                    value={chapters}
                    placeholder={"Chapters, one per line (optional)\n1. Starting from scratch\n2. Hierarchy is everything"}
                    onChange={(event) => setChapters(event.target.value)}
                    rows={3}
                    className="text-xs"
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={working !== null || bookTitle.trim().length === 0}
                    onClick={() =>
                        run("add-book", async () => {
                            const outline = chapters
                                .split(/\r?\n/)
                                .map((line) => line.trim())
                                .filter(Boolean);
                            await onAddBook(bookTitle.trim(), outline);
                            setBookTitle("");
                            setChapters("");
                        })
                    }
                >
                    Add book
                </Button>
            </section>

            <section aria-labelledby="scout-url-heading" className="space-y-3">
                <h3 id="scout-url-heading" className="flex items-center gap-2 text-xs text-text-soft">
                    <Link2 size={12} /> Add a URL
                </h3>
                <Input
                    aria-label="Resource URL"
                    value={url}
                    placeholder="https://…"
                    onChange={(event) => setUrl(event.target.value)}
                    className="h-9 text-xs"
                />
                <Input
                    aria-label="Note"
                    value={note}
                    placeholder="Why save it? (optional)"
                    onChange={(event) => setNote(event.target.value)}
                    className="h-9 text-xs"
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={working !== null || url.trim().length === 0}
                    onClick={() =>
                        run("add-url", async () => {
                            await onAddUrl(url.trim(), note.trim() || undefined);
                            setUrl("");
                            setNote("");
                        })
                    }
                >
                    Save to library
                </Button>
            </section>

            <section aria-labelledby="scout-settings-heading" className="space-y-3">
                <h3 id="scout-settings-heading" className="text-xs text-text-soft">
                    Settings
                </h3>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-text">Auto-check</p>
                        <p className="text-xs leading-5 text-text-soft">Nightly at 3:00 AM, Asia/Dubai.</p>
                    </div>
                    <Switch
                        aria-label="Auto-check nightly"
                        checked={settings?.autoCheck ?? true}
                        disabled={!settings || working !== null}
                        onCheckedChange={(checked) => run("auto-check", () => onToggleAutoCheck(checked))}
                    />
                </div>

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-text">Pause Scout</p>
                        <p className="text-xs leading-5 text-text-soft">Stops the nightly check, keeps your library.</p>
                    </div>
                    <Switch
                        aria-label="Pause Scout"
                        checked={settings?.paused ?? false}
                        disabled={!settings || working !== null}
                        onCheckedChange={(checked) => run("pause", () => onPause(checked))}
                    />
                </div>
            </section>

            {spend ? <CostMeter monthCents={spend.monthCents} budgetCents={spend.budgetCents} packCents={spend.packCents} /> : null}

            {localError ? (
                <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
                    {localError}
                </p>
            ) : null}
        </aside>
    );
}
