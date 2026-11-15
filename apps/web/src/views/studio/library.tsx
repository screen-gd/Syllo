import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, Library, Menu, Upload } from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import {
    AttachmentDrop,
    AttachmentDropTrigger,
} from "@/components/glaze/ui/attachment";
import { Badge } from "@/components/glaze/ui/badge";
import {
    Empty,
    EmptyContent,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/glaze/ui/item";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { Select } from "@/components/glaze/ui/select";
import { toast } from "@/components/glaze/ui/toast";
import { importEpub } from "@/lib/personal/books";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import { useCloudSync } from "@/components/sync/CloudSync";
import PageFrame from "@/components/layout/PageFrame";

export default function LibraryPage() {
    const records = usePersonalData();
    const sync = useCloudSync();
    const books = useMemo(
        () =>
            personalEntries(records, "book")
                .map((entry) => entry.data)
                .sort((a, b) => a.title.localeCompare(b.title)),
        [records],
    );
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const [status, setStatus] = useState("all");
    const [groupBy, setGroupBy] = useState("status");
    const [view, setView] = useState<"spines" | "list">("spines");
    const [importing, setImporting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const categories = [...new Set(books.map((book) => book.category))].sort();
    const filtered = books.filter(
        (book) =>
            (category === "all" || category === book.category) &&
            (status === "all" || status === book.status) &&
            `${book.title} ${book.author}`
                .toLowerCase()
                .includes(query.toLowerCase()),
    );
    const statusNames: Record<string, string> = {
        reading: "Reading",
        "to-read": "To read",
        finished: "Finished",
    };
    const groups =
        groupBy === "status" ? ["reading", "to-read", "finished"] : categories;
    async function onImport(files: File[]) {
        if (!files.length) return;
        setError(null);
        const failures: string[] = [];
        for (const file of files) {
            setImporting(file.name);
            try {
                const book = await importEpub(file);
                await sync.uploadBook(book);
                toast.success(`Added ${book.title}`);
            } catch (cause) {
                failures.push(
                    `${file.name}: ${cause instanceof Error ? cause.message : "Could not import this book."}`,
                );
            }
        }
        setImporting(null);
        if (failures.length) setError(failures.join(" "));
    }
    return (
        <PageFrame
            title="Library"
            subtitle={`${books.length} book${books.length === 1 ? "" : "s"} · ${books.filter((book) => book.status === "reading").length} currently reading`}
            actions={
                <AttachmentDrop
                    accept=".epub,application/epub+zip"
                    onFiles={(files) => void onImport(files)}
                >
                    <AttachmentDropTrigger
                        pending={!!importing}
                        pendingLabel="Importing"
                    >
                        <Icon icon={Upload} />
                        Import EPUB
                    </AttachmentDropTrigger>
                </AttachmentDrop>
            }
        >
            {error && <Alert status="fail">{error}</Alert>}
            {importing && (
                <p className="type-caption text-text-2" role="status">
                    Importing {importing}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    mode="search"
                    className="w-56"
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search books or authors"
                    aria-label="Search books"
                />
                <div className="w-48">
                    <Select
                        native
                        aria-label="Book category"
                        value={category}
                        onValueChange={(value) => setCategory(value ?? "all")}
                        items={[
                            { value: "all", label: "All categories" },
                            ...categories.map((value) => ({
                                value,
                                label: value,
                            })),
                        ]}
                    />
                </div>
                <div className="w-44">
                    <Select
                        native
                        aria-label="Reading status"
                        value={status}
                        onValueChange={(value) => setStatus(value ?? "all")}
                        items={[
                            { value: "all", label: "All books" },
                            { value: "reading", label: "Reading" },
                            { value: "to-read", label: "To read" },
                            { value: "finished", label: "Finished" },
                        ]}
                    />
                </div>
                <div className="w-44">
                    <Select
                        native
                        aria-label="Group books by"
                        value={groupBy}
                        onValueChange={(value) => setGroupBy(value ?? "status")}
                        items={[
                            { value: "status", label: "Reading status" },
                            { value: "category", label: "Category" },
                        ]}
                    />
                </div>
                <SegmentedControl
                    aria-label="Library view"
                    value={view}
                    onValueChange={(value) =>
                        setView(value as "spines" | "list")
                    }
                >
                    <SegmentedControlItem value="spines" aria-label="Book spines">
                        <Icon icon={Library} />
                    </SegmentedControlItem>
                    <SegmentedControlItem value="list" aria-label="Book list">
                        <Icon icon={Menu} />
                    </SegmentedControlItem>
                </SegmentedControl>
            </div>
            {!books.length ? (
                <Empty reason="empty">
                    <EmptyHeader>
                        <EmptyTitle>Your books belong here.</EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                        <p className="type-body-sm text-text-2">
                            Import an EPUB to read, highlight, and save your
                            place.
                        </p>
                        <p className="type-body-sm text-text-2">
                            Books are cached on this device
                            {sync.status === "connected"
                                ? " and synced privately to your other devices"
                                : "; cloud sync can be connected in Settings"}
                            .
                        </p>
                    </EmptyContent>
                </Empty>
            ) : !filtered.length ? (
                <Empty variant="plain" reason="empty">
                    <EmptyHeader>
                        <EmptyTitle>
                            No books match these filters.
                        </EmptyTitle>
                    </EmptyHeader>
                </Empty>
            ) : view === "spines" ? (
                groups.map((group) => {
                    const items = filtered.filter(
                        (book) =>
                            (groupBy === "status"
                                ? book.status
                                : book.category) === group,
                    );
                    if (!items.length) return null;
                    const label =
                        groupBy === "status" &&
                        (group === "reading" ||
                            group === "to-read" ||
                            group === "finished")
                            ? statusNames[group]
                            : group;
                    return (
                        <section className="shell" key={group}>
                            <div className="panel">
                                <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                    <h2 className="type-heading-sm">{label}</h2>
                                    <span className="type-caption text-text-2">
                                        {items.length}
                                    </span>
                                </header>
                                <div className="flex flex-wrap gap-3 px-4 pb-4">
                                    {items.map((book) => (
                                        <Link
                                            key={book.id}
                                            to="/read/$id"
                                            params={{ id: book.id }}
                                            title={`${book.title} · ${book.author}`}
                                            aria-label={`Open ${book.title}`}
                                            className="flex h-48 w-32 flex-col rounded-panel border border-line-faint bg-field p-3 transition-colors hover:bg-hover"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <b className="line-clamp-4 type-label text-text-1">
                                                    {book.title}
                                                </b>
                                                <span className="mt-1 line-clamp-2 block type-caption text-text-2">
                                                    {book.author}
                                                </span>
                                            </span>
                                            <span className="flex items-center justify-between gap-1">
                                                {book.status === "reading" ? (
                                                    <Badge>Reading</Badge>
                                                ) : (
                                                    <span />
                                                )}
                                                {book.percent > 0 && (
                                                    <span className="type-caption text-text-2">
                                                        {Math.round(
                                                            book.percent,
                                                        )}
                                                        %
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </section>
                    );
                })
            ) : (
                <section className="shell">
                    <div className="panel">
                        <header className="flex items-center justify-between gap-3 p-4 pb-3">
                            <h2 className="type-heading-sm">Books</h2>
                            <span className="type-caption text-text-2">
                                {filtered.length}
                            </span>
                        </header>
                        <ItemGroup variant="plain" className="px-1 pb-1">
                            {filtered.map((book) => (
                                <Item
                                    key={book.id}
                                    render={
                                        <Link
                                            to="/read/$id"
                                            params={{ id: book.id }}
                                        />
                                    }
                                >
                                    <ItemContent>
                                        <ItemTitle>{book.title}</ItemTitle>
                                        <ItemDescription>
                                            {book.author}
                                        </ItemDescription>
                                    </ItemContent>
                                    <span className="type-caption text-text-2">
                                        {book.category}
                                    </span>
                                    <span className="type-caption text-text-2">
                                        {statusNames[book.status]}
                                        {book.percent > 0 &&
                                            ` · ${Math.round(book.percent)}%`}
                                    </span>
                                </Item>
                            ))}
                        </ItemGroup>
                    </div>
                </section>
            )}
        </PageFrame>
    );
}
