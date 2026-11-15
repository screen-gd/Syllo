import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, Library, Menu, Upload } from "@/components/glaze/icon";
import { Alert } from "@/components/glaze/ui/alert";
import {
    AttachmentDrop,
    AttachmentDropTrigger,
} from "@/components/glaze/ui/attachment";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/glaze/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMeta,
    ItemTitle,
} from "@/components/glaze/ui/item";
import BookCover from "@/components/learning/BookCover";
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
    const importButton = (
        <AttachmentDrop
            accept=".epub,application/epub+zip"
            onFiles={(files) => void onImport(files)}
        >
            <AttachmentDropTrigger
                size="default"
                pending={!!importing}
                pendingLabel="Importing"
            >
                <Icon icon={Upload} />
                Import EPUB
            </AttachmentDropTrigger>
        </AttachmentDrop>
    );
    const filtersOn =
        query.trim() !== "" || category !== "all" || status !== "all";
    return (
        <PageFrame
            title="Library"
            subtitle={`${books.length} book${books.length === 1 ? "" : "s"} · ${books.filter((book) => book.status === "reading").length} currently reading`}
            actions={books.length ? importButton : undefined}
        >
            {error && <Alert status="fail">{error}</Alert>}
            {importing && (
                <p className="type-caption text-text-2" role="status">
                    Importing {importing}
                </p>
            )}
            <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
                <Input
                    mode="search"
                    className="col-span-2 sm:w-56"
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search books or authors"
                    aria-label="Search books"
                />
                <div className="sm:w-48">
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
                <div className="sm:w-44">
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
                <div className="sm:w-44">
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
                        <EmptyTitle>No books yet</EmptyTitle>
                        <EmptyDescription>
                            Import an EPUB to read, highlight and save your
                            place.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>{importButton}</EmptyContent>
                </Empty>
            ) : !filtered.length ? (
                <Empty variant="plain" reason="no-results">
                    <EmptyHeader>
                        <EmptyTitle>
                            {query.trim() ? (
                                <>
                                    No books match <code>{query.trim()}</code>
                                </>
                            ) : (
                                "No books in this category or status"
                            )}
                        </EmptyTitle>
                    </EmptyHeader>
                    {filtersOn && (
                        <EmptyContent>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setQuery("");
                                    setCategory("all");
                                    setStatus("all");
                                }}
                            >
                                Clear filters
                            </Button>
                        </EmptyContent>
                    )}
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
                        <Card key={group}>
                            <CardHeader>
                                <CardTitle>
                                    <h2 className="type-heading-sm">{label}</h2>
                                </CardTitle>
                                <CardAction>
                                    <Badge count={items.length} />
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
                                    {items.map((book) => (
                                        <Link
                                            key={book.id}
                                            to="/read/$id"
                                            params={{ id: book.id }}
                                            title={`${book.title} · ${book.author}`}
                                            aria-label={`Open ${book.title}`}
                                            className="group flex min-w-0 flex-col gap-1.5 rounded-tag"
                                        >
                                            <span className="block transition-[translate,scale] duration-(--dur-state) ease-out motion-safe:group-hover:-translate-y-0.5 group-active:scale-(--scale-press)">
                                                <BookCover book={book} compact />
                                            </span>
                                            <span className="line-clamp-2 type-label text-text-1 group-hover:underline">
                                                {book.title}
                                            </span>
                                            <span className="line-clamp-1 type-caption text-text-2">
                                                {book.author}
                                            </span>
                                            {book.percent > 0 && (
                                                <span className="type-caption text-text-2">
                                                    {Math.round(book.percent)}% read
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2 className="type-heading-sm">Books</h2>
                        </CardTitle>
                        <CardAction>
                            <Badge count={filtered.length} />
                        </CardAction>
                    </CardHeader>
                    <CardContent flush>
                        <ItemGroup variant="plain" aria-label="Books">
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
                                    <ItemMeta>
                                        {book.category} ·{" "}
                                        {statusNames[book.status]}
                                        {book.percent > 0 &&
                                            ` · ${Math.round(book.percent)}%`}
                                    </ItemMeta>
                                </Item>
                            ))}
                        </ItemGroup>
                    </CardContent>
                </Card>
            )}
        </PageFrame>
    );
}
