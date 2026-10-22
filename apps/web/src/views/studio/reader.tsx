import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Book, Contents, Rendition } from "epubjs";
import type { Location } from "epubjs/types/rendition";
import type { NavItem } from "epubjs/types/navigation";
import { ArrowLeft, ArrowRight, Highlighter, Moon, Sun } from "lucide-react";
import { z } from "zod";
import {
    usePersonalData,
    personalEntries,
    putPersonalEntry,
} from "@/lib/personal/store";
import { getBookFile, updateBook } from "@/lib/personal/books";
import { getLocalFile, saveLocalFile } from "@/lib/personal/files";
import { useCloudSync } from "@/components/sync/CloudSync";
import ReviewComposer from "@/components/learning/ReviewComposer";

const preferencesSchema = z.object({
    size: z.number().min(14).max(30),
    night: z.boolean(),
});
function flattenToc(items: NavItem[]): NavItem[] {
    return items.flatMap((item) => [item, ...flattenToc(item.subitems ?? [])]);
}

function applyReaderAppearance(rendition: Rendition, size: number, night: boolean) {
    const foreground = night ? "#e1dfd9" : "#2a2925";
    const background = night ? "#191a1d" : "#f0eee7";
    rendition.themes.default({
        body: {
            color: `${foreground} !important`,
            background: `${background} !important`,
            "font-family": "Georgia, serif !important",
            "line-height": "1.85 !important",
            padding: "20px 26px !important",
        },
        a: { color: `${foreground} !important` },
    });
    rendition.themes.fontSize(`${size}px`);
}

export default function ReaderPage({
    id,
    targetCfi,
}: {
    id: string;
    targetCfi?: string;
}) {
    const records = usePersonalData();
    const entry = records[`book:${id}`];
    const book = entry?.kind === "book" && !entry.deleted ? entry.data : null;
    const bookRef = useRef(book);
    bookRef.current = book;
    const sync = useCloudSync();
    const host = useRef<HTMLDivElement>(null);
    const epubRef = useRef<Book | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toc, setToc] = useState<NavItem[]>([]);
    const [size, setSize] = useState(18);
    const [night, setNight] = useState(false);
    const appearanceRef = useRef({ size, night });
    appearanceRef.current = { size, night };
    const [selection, setSelection] = useState<{
        cfi: string;
        quote: string;
    } | null>(null);
    const [draft, setDraft] = useState("");
    const annotations = useMemo(
        () =>
            personalEntries(records, "annotation")
                .filter(
                    (item) =>
                        item.data.anchor.kind === "book" &&
                        item.data.anchor.bookId === id,
                )
                .sort((a, b) => b.updatedAt - a.updatedAt),
        [records, id],
    );
    const highlighted = useRef(new Set<string>());
    useEffect(() => {
        try {
            const raw = localStorage.getItem("syllo:reader-preferences");
            const result = preferencesSchema.safeParse(
                raw ? JSON.parse(raw) : null,
            );
            if (result.success) {
                setSize(result.data.size);
                setNight(result.data.night);
            }
        } catch {
            /* Use the default reader appearance. */
        }
    }, []);
    const fileKey = book?.fileKey;
    const downloadFile = sync.downloadFile;
    const downloadRef = useRef(downloadFile);
    downloadRef.current = downloadFile;
    const cloudAvailable = !!downloadFile;
    useEffect(() => {
        const current = bookRef.current;
        if (!current || !host.current) return;
        let disposed = false;
        let observer: ResizeObserver | null = null;
        let ownedBook: Book | null = null;
        const highlights = highlighted.current;
        setError(null);
        setReady(false);
        void (async () => {
            const file = await getBookFile(current, downloadRef.current);
            const { default: ePub } = await import("epubjs");
            if (disposed || !host.current) return;
            const epub = ePub();
            ownedBook = epub;
            epubRef.current = epub;
            await epub.open(await file.arrayBuffer(), "binary");
            if (disposed || !host.current) return;
            const navigation = await epub.loaded.navigation;
            const chapters = flattenToc(navigation.toc);
            if (disposed) return;
            setToc(chapters);
            const cachedLocations = await getLocalFile(
                `${current.fileKey}:locations`,
            );
            if (cachedLocations) {
                try {
                    epub.locations.load(await cachedLocations.text());
                } catch {
                    /* Regenerate outdated location indexes below. */
                }
            }
            let width = host.current.clientWidth;
            let height = host.current.clientHeight;
            const rendition = epub.renderTo(host.current, {
                width,
                height,
                spread: "none",
                flow: "paginated",
                allowScriptedContent: false,
            });
            renditionRef.current = rendition;
            // Restore the passage using its final typography and pagination.
            applyReaderAppearance(
                rendition,
                appearanceRef.current.size,
                appearanceRef.current.night,
            );
            rendition.on("selected", (cfi: string, contents: Contents) => {
                const quote = contents.window.getSelection()?.toString().trim();
                if (quote) setSelection({ cfi, quote: quote.slice(0, 6000) });
            });
            rendition.on("relocated", (location: Location) => {
                if (disposed) return;
                const chapter = chapters.find(
                    (item) =>
                        item.href.split("#")[0] ===
                        location.start.href.split("#")[0],
                );
                const fraction =
                    epub.locations.length() > 0
                        ? epub.locations.percentageFromCfi(location.start.cfi)
                        : null;
                updateBook(id, {
                    position: location.start.cfi,
                    chapter:
                        chapter?.label.trim() ||
                        bookRef.current?.chapter ||
                        "Reading",
                    ...(fraction !== null && Number.isFinite(fraction)
                        ? {
                              percent: Math.min(
                                  100,
                                  Math.max(0, fraction * 100),
                              ),
                          }
                        : {}),
                    status:
                        bookRef.current?.status === "finished"
                            ? "finished"
                            : "reading",
                    lastReadAt: new Date().toISOString(),
                });
            });
            await rendition.display(targetCfi ?? current.position ?? undefined);
            if (disposed) return;
            setReady(true);
            observer = new ResizeObserver((entries) => {
                const bounds = entries[0]?.contentRect;
                if (!bounds) return;
                // Match client dimensions: fractional CSS heights otherwise
                // trigger a resize before EPUB.js has recorded its location.
                const nextWidth = Math.round(bounds.width);
                const nextHeight = Math.round(bounds.height);
                if (
                    nextWidth > 0 &&
                    nextHeight > 0 &&
                    (nextWidth !== width || nextHeight !== height)
                ) {
                    width = nextWidth;
                    height = nextHeight;
                    rendition.resize(width, height);
                }
            });
            observer.observe(host.current);
            if (epub.locations.length() === 0) {
                await epub.locations.generate(1800);
                if (!disposed) {
                    await saveLocalFile(
                        `${current.fileKey}:locations`,
                        new Blob([epub.locations.save()], {
                            type: "application/json",
                        }),
                    );
                    const position = bookRef.current?.position;
                    if (position)
                        updateBook(id, {
                            percent: Math.min(
                                100,
                                Math.max(
                                    0,
                                    epub.locations.percentageFromCfi(position) *
                                        100,
                                ),
                            ),
                        });
                }
            }
        })().catch((cause) => {
            if (!disposed)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Could not open this EPUB.",
                );
        });
        return () => {
            disposed = true;
            observer?.disconnect();
            highlights.clear();
            renditionRef.current?.destroy();
            renditionRef.current = null;
            ownedBook?.destroy();
            epubRef.current = null;
        };
    }, [id, fileKey, cloudAvailable, targetCfi]);
    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition || !ready) return;
        applyReaderAppearance(rendition, size, night);
        localStorage.setItem(
            "syllo:reader-preferences",
            JSON.stringify({ size, night }),
        );
    }, [ready, size, night]);
    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition || !ready) return;
        for (const item of annotations) {
            const anchor = item.data.anchor;
            if (anchor.kind !== "book" || highlighted.current.has(anchor.cfi))
                continue;
            try {
                rendition.annotations.highlight(
                    anchor.cfi,
                    {},
                    undefined,
                    "syllo-highlight",
                    {
                        fill: item.data.color,
                        "fill-opacity": "0.3",
                        "mix-blend-mode": "multiply",
                    },
                );
                highlighted.current.add(anchor.cfi);
            } catch {
                /* Keep a note even when a revised EPUB invalidates its highlight. */
            }
        }
    }, [annotations, ready]);
    function saveAnnotation(text: string) {
        if (!selection) return;
        putPersonalEntry({
            id: `annotation:${crypto.randomUUID()}`,
            kind: "annotation",
            updatedAt: Date.now(),
            deleted: false,
            data: {
                text: text.trim(),
                quote: selection.quote,
                color: "#c5ce7b",
                anchor: { kind: "book", bookId: id, cfi: selection.cfi },
                createdAt: new Date().toISOString(),
            },
        });
        setDraft("");
        setSelection(null);
    }
    async function display(target: string) {
        try {
            await renditionRef.current?.display(target);
        } catch {
            setError("Could not open that passage. The EPUB may have changed.");
        }
    }
    if (!book)
        return (
            <div className="sy-page">
                <h1>Book not found</h1>
                <div className="sy-empty">
                    <p>
                        Import the book on this device, or connect your synced
                        library.
                    </p>
                    <Link className="sy-button secondary" to="/library">
                        Back to Library
                    </Link>
                </div>
            </div>
        );
    return (
        <div className="sy-page">
            <div className="sy-breadcrumb">
                <Link to="/library">Library</Link>
                <span>/</span>
                <span>{book.title}</span>
            </div>
            <header className="sy-reader-head">
                <div>
                    <h1>{book.title}</h1>
                    <p>
                        {book.author} · {book.chapter}
                    </p>
                </div>
                <Link className="sy-button quiet" to="/library">
                    Back to Library
                </Link>
            </header>
            <div className="sy-reader-tools">
                <div className="sy-reader-controls">
                    <button
                        className="sy-button secondary"
                        aria-label="Smaller text"
                        onClick={() =>
                            setSize((value) => Math.max(14, value - 1))
                        }
                    >
                        A−
                    </button>
                    <button
                        className="sy-button secondary"
                        aria-label="Larger text"
                        onClick={() =>
                            setSize((value) => Math.min(30, value + 1))
                        }
                    >
                        A+
                    </button>
                    <button
                        className="sy-button quiet"
                        onClick={() => setNight((value) => !value)}
                        aria-label={
                            night ? "Light reading page" : "Dark reading page"
                        }
                    >
                        {night ? <Sun /> : <Moon />}
                    </button>
                </div>
                <select
                    className="sy-select"
                    aria-label="Table of contents"
                    defaultValue=""
                    onChange={(event) => {
                        if (event.target.value)
                            void display(event.target.value);
                    }}
                >
                    <option value="" disabled>
                        Contents
                    </option>
                    {toc.map((item, index) => (
                        <option key={`${item.id}:${index}`} value={item.href}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </div>
            {error && (
                <p className="sy-error" role="alert">
                    {error}
                </p>
            )}
            {!ready && !error && (
                <p role="status" className="sy-loading">
                    Opening your book…
                </p>
            )}
            <div className={`sy-reader${night ? " night" : ""}`}>
                <div className="sy-reader-mount" ref={host} />
            </div>
            <div className="sy-reader-pagination">
                <button
                    className="sy-button quiet"
                    disabled={!ready}
                    onClick={() =>
                        void renditionRef.current
                            ?.prev()
                            .catch(() =>
                                setError("Could not open the previous page."),
                            )
                    }
                >
                    <ArrowLeft />
                    Previous
                </button>
                <span>{Math.round(book.percent)}% read</span>
                <button
                    className="sy-button quiet"
                    disabled={!ready}
                    onClick={() =>
                        void renditionRef.current
                            ?.next()
                            .catch(() =>
                                setError("Could not open the next page."),
                            )
                    }
                >
                    Next
                    <ArrowRight />
                </button>
            </div>
            <div className="sy-reader-fields">
                <label>
                    Category
                    <input
                        className="sy-input"
                        aria-label="Book category"
                        key={book.id}
                        defaultValue={book.category}
                        onBlur={(event) =>
                            updateBook(id, {
                                category:
                                    event.target.value.trim() ||
                                    "Uncategorized",
                            })
                        }
                    />
                </label>
                <label>
                    Reading status
                    <select
                        className="sy-select"
                        value={book.status}
                        onChange={(event) => {
                            const result = z
                                .enum(["to-read", "reading", "finished"])
                                .safeParse(event.target.value);
                            if (result.success)
                                updateBook(id, {
                                    status: result.data,
                                    ...(result.data === "finished"
                                        ? { percent: 100 }
                                        : {}),
                                });
                        }}
                    >
                        <option value="to-read">To read</option>
                        <option value="reading">Reading</option>
                        <option value="finished">Finished</option>
                    </select>
                </label>
            </div>
            <section className="sy-reader-notes">
                <div className="sy-section-head">
                    <h2>Passage notes and highlights</h2>
                </div>
                {selection ? (
                    <>
                        <blockquote className="sy-passage">
                            {selection.quote}
                        </blockquote>
                        <textarea
                            className="sy-textarea"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="What do you want to remember about this passage?"
                            aria-label="Note on selected passage"
                        />
                        <div className="sy-note-controls">
                            <button
                                className="sy-button quiet"
                                onClick={() => saveAnnotation("")}
                            >
                                <Highlighter />
                                Keep highlight
                            </button>
                            <button
                                className="sy-button secondary"
                                onClick={() => saveAnnotation(draft)}
                            >
                                Save passage note
                            </button>
                        </div>
                        <ReviewComposer
                            roadmapId={`book:${id}`}
                            source={{
                                bookId: id,
                                cfi: selection.cfi,
                                quote: selection.quote,
                            }}
                            initialAnswer={selection.quote}
                        />
                    </>
                ) : (
                    <p className="sy-muted sy-small">
                        Select text in the book to highlight it, attach a note,
                        or make a review card.
                    </p>
                )}
                {annotations.map((item) => (
                    <article className="sy-saved-note" key={item.id}>
                        <button
                            className="sy-time-link"
                            onClick={() => {
                                if (item.data.anchor.kind === "book")
                                    void display(item.data.anchor.cfi);
                            }}
                        >
                            Return to passage
                            <ArrowRight size={13} />
                        </button>
                        <blockquote>{item.data.quote}</blockquote>
                        {item.data.text && <p>{item.data.text}</p>}
                    </article>
                ))}
            </section>
        </div>
    );
}
