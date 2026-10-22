import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Library, List, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { importEpub } from "@/lib/personal/books";
import { personalEntries, usePersonalData } from "@/lib/personal/store";
import { useCloudSync } from "@/components/sync/CloudSync";
import type { LibraryBook } from "@/lib/personal/schema";

function spineStyle(
    book: LibraryBook,
): CSSProperties & Record<`--${string}`, string> {
    return {
        "--book-color": book.color,
        "--spine-width": `${48 + Math.min(22, Math.round(Math.log2(Math.max(1, book.fileSize / 1000))))}px`,
        "--spine-height": `${208 + (book.title.length % 28)}px`,
    };
}

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
    const fileInput = useRef<HTMLInputElement>(null);
    const categories = [...new Set(books.map((book) => book.category))].sort();
    const filtered = books.filter(
        (book) =>
            (category === "all" || category === book.category) &&
            (status === "all" || status === book.status) &&
            `${book.title} ${book.author}`
                .toLowerCase()
                .includes(query.toLowerCase()),
    );
    const statusNames = {
        reading: "Reading",
        "to-read": "To read",
        finished: "Finished",
    };
    const groups =
        groupBy === "status" ? ["reading", "to-read", "finished"] : categories;
    async function onImport(files: FileList | null) {
        if (!files) return;
        setError(null);
        const failures: string[] = [];
        for (const file of Array.from(files)) {
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
        if (fileInput.current) fileInput.current.value = "";
    }
    return (
        <div className="sy-page">
            <header className="sy-page-head">
                <div>
                    <h1>Library</h1>
                    <p>
                        {books.length} book{books.length === 1 ? "" : "s"} ·{" "}
                        {
                            books.filter((book) => book.status === "reading")
                                .length
                        }{" "}
                        currently reading
                    </p>
                </div>
                <button
                    className="sy-button primary"
                    disabled={!!importing}
                    onClick={() => fileInput.current?.click()}
                >
                    <Upload size={15} />
                    {importing ? "Importing…" : "Import EPUB"}
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".epub,application/epub+zip"
                    multiple
                    hidden
                    onChange={(event) => void onImport(event.target.files)}
                />
            </header>
            {error && (
                <p role="alert" className="sy-error">
                    {error}
                </p>
            )}
            {importing && (
                <p className="sy-muted sy-small" role="status">
                    Importing {importing}
                </p>
            )}
            <div className="sy-library-tools">
                <label className="sy-search">
                    <Search />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search books or authors"
                        aria-label="Search books"
                    />
                </label>
                <div className="sy-filters">
                    <select
                        className="sy-select"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        aria-label="Book category"
                    >
                        <option value="all">All categories</option>
                        {categories.map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                    <select
                        className="sy-select"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        aria-label="Reading status"
                    >
                        <option value="all">All books</option>
                        <option value="reading">Reading</option>
                        <option value="to-read">To read</option>
                        <option value="finished">Finished</option>
                    </select>
                    <select
                        className="sy-select"
                        value={groupBy}
                        onChange={(event) => setGroupBy(event.target.value)}
                        aria-label="Group books by"
                    >
                        <option value="status">Reading status</option>
                        <option value="category">Category</option>
                    </select>
                    <div className="sy-view-switch">
                        <button
                            aria-label="Book spines"
                            aria-pressed={view === "spines"}
                            onClick={() => setView("spines")}
                        >
                            <Library size={17} />
                        </button>
                        <button
                            aria-label="Book list"
                            aria-pressed={view === "list"}
                            onClick={() => setView("list")}
                        >
                            <List size={17} />
                        </button>
                    </div>
                </div>
            </div>
            {!books.length ? (
                <div className="sy-empty bordered">
                    <h2>Your books belong here.</h2>
                    <p style={{ marginTop: 8 }}>
                        Import an EPUB to read, highlight, and save your place.
                    </p>
                    <p>
                        Books are cached on this device
                        {sync.status === "connected"
                            ? " and synced privately to your other devices"
                            : "; cloud sync can be connected in Settings"}
                        .
                    </p>
                </div>
            ) : !filtered.length ? (
                <p className="sy-empty">No books match these filters.</p>
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
                        <section className="sy-shelf-group" key={group}>
                            <h2>
                                {label} · {items.length}
                            </h2>
                            <div className="sy-shelf">
                                {items.map((book) => (
                                    <Link
                                        key={book.id}
                                        to="/read/$id"
                                        params={{ id: book.id }}
                                        className="sy-spine"
                                        title={`${book.title} · ${book.author}`}
                                        aria-label={`Open ${book.title}`}
                                        style={spineStyle(book)}
                                    >
                                        {book.status === "reading" && (
                                            <span className="sy-bookmark" />
                                        )}
                                        <span className="sy-spine-title">
                                            {book.title}
                                        </span>
                                        <span className="sy-spine-author">
                                            {book.author}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    );
                })
            ) : (
                filtered.map((book) => (
                    <Link
                        className="sy-library-row"
                        key={book.id}
                        to="/read/$id"
                        params={{ id: book.id }}
                    >
                        <div>
                            <h3>{book.title}</h3>
                            <p>{book.author}</p>
                        </div>
                        <span>{book.category}</span>
                        <span>
                            {statusNames[book.status]}
                            {book.percent > 0
                                ? ` · ${Math.round(book.percent)}%`
                                : ""}
                        </span>
                    </Link>
                ))
            )}
        </div>
    );
}
