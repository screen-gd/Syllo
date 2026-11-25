import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Book, Contents, Rendition } from "epubjs";
import type { Location } from "epubjs/types/rendition";
import type { NavItem } from "epubjs/types/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Dark, Icon, Light } from "@/components/glaze/icon";
import { Alert, AlertDescription } from "@/components/glaze/ui/alert";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/glaze/ui/breadcrumb";
import { Button } from "@/components/glaze/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/glaze/ui/item";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/glaze/ui/select";
import { Skeleton } from "@/components/glaze/ui/skeleton";
import { Textarea } from "@/components/glaze/ui/textarea";
import {
    usePersonalData,
    personalEntries,
    putPersonalEntry,
} from "@/lib/personal/store";
import { getBookFile, updateBook } from "@/lib/personal/books";
import { getLocalFile, saveLocalFile } from "@/lib/personal/files";
import { useCloudSync } from "@/components/sync/CloudSync";
import ReviewComposer from "@/components/learning/ReviewComposer";
import PageFrame from "@/components/layout/PageFrame";

const preferencesSchema = z.object({
    size: z.number().min(14).max(30),
    night: z.boolean(),
});
function flattenToc(items: NavItem[]): NavItem[] {
    return items.flatMap((item) => [item, ...flattenToc(item.subitems ?? [])]);
}

/**
 * Styles the book's pages from the Glaze tokens on the element that holds them, so the page follows the
 * light or dark reading surface around it. Call again after the surface's theme or the text size changes.
 */
function applyReaderAppearance(rendition: Rendition, size: number, surface: HTMLElement) {
    const tokens = getComputedStyle(surface);
    const foreground = tokens.getPropertyValue("--text-1").trim();
    const background = tokens.getPropertyValue("--paper").trim();
    rendition.themes.default({
        body: {
            color: `${foreground} !important`,
            background: `${background} !important`,
            "font-family": `${tokens.getPropertyValue("--font-sans").trim()} !important`,
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
                host.current,
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
        if (host.current) applyReaderAppearance(rendition, size, host.current);
        localStorage.setItem(
            "syllo:reader-preferences",
            JSON.stringify({ size, night }),
        );
    }, [ready, size, night]);
    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition || !ready || !host.current) return;
        // Highlights take the ink of the reading surface at a low opacity, so they read on a light or a dark page.
        const ink = getComputedStyle(host.current)
            .getPropertyValue("--text-1")
            .trim();
        for (const cfi of highlighted.current)
            rendition.annotations.remove(cfi, "highlight");
        highlighted.current.clear();
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
                    { fill: ink, "fill-opacity": "0.16" },
                );
                highlighted.current.add(anchor.cfi);
            } catch {
                /* Keep a note even when a revised EPUB invalidates its highlight. */
            }
        }
    }, [annotations, ready, night]);
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
                color: "#a5ad4a",
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
            <PageFrame title="Library">
                <Empty reason="no-results" className="w-full max-w-md self-center">
                    <EmptyHeader>
                        <EmptyTitle>Book not found</EmptyTitle>
                        <EmptyDescription>
                            Import the book on this device, or connect your synced
                            library.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            variant="secondary"
                            nativeButton={false}
                            render={<Link to="/library" />}
                        >
                            Back to library
                        </Button>
                    </EmptyContent>
                </Empty>
            </PageFrame>
        );
    const tocItems = toc.map((item) => ({
        value: item.href,
        label: item.label,
    }));
    const statusItems = [
        { value: "to-read", label: "To read" },
        { value: "reading", label: "Reading" },
        { value: "finished", label: "Finished" },
    ];
    return (
        <div className="mx-auto flex w-full max-w-256 flex-col gap-4 lg:max-w-none lg:pt-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link to="/library" />}>Library</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{book.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <header className="min-w-0">
                <h1 className="type-title">{book.title}</h1>
                <p className="mt-1 type-body-sm text-text-2">
                    {book.author} · {book.chapter}
                </p>
            </header>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-faint pb-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label="Smaller text"
                        onClick={() =>
                            setSize((value) => Math.max(14, value - 1))
                        }
                    >
                        A−
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label="Larger text"
                        onClick={() =>
                            setSize((value) => Math.min(30, value + 1))
                        }
                    >
                        A+
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setNight((value) => !value)}
                        aria-label={
                            night ? "Light reading page" : "Dark reading page"
                        }
                    >
                        <Icon icon={night ? Light : Dark} />
                    </Button>
                </div>
                <div className="w-full sm:w-64">
                    <Select
                        value={null}
                        onValueChange={(value) => {
                            if (value) void display(value);
                        }}
                        items={tocItems}
                    >
                        <SelectTrigger aria-label="Table of contents">
                            <SelectValue>Contents</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {tocItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {error && (
                <Alert status="fail">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <div
                data-theme={night ? "dark" : undefined}
                className="glaze relative overflow-hidden rounded-panel border border-line-faint bg-paper"
            >
                {!ready && !error && (
                    <Skeleton
                        className="absolute inset-0 rounded-panel"
                        aria-label="Loading"
                    />
                )}
                <div className="h-120 w-full md:h-160" ref={host} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={!ready}
                    onClick={() =>
                        void renditionRef.current
                            ?.prev()
                            .catch(() =>
                                setError("Could not open the previous page."),
                            )
                    }
                >
                    <Icon icon={ArrowLeft} />
                    Previous
                </Button>
                <span className="type-caption tabular-nums text-text-2">{Math.round(book.percent)}% read</span>
                <Button
                    variant="ghost"
                    size="sm"
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
                    <Icon icon={ArrowRight} />
                </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                    <FieldLabel>Category</FieldLabel>
                    <Input
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
                </Field>
                <Field>
                    <FieldLabel>Reading status</FieldLabel>
                    <Select
                        value={book.status}
                        onValueChange={(value) => {
                            const result = z
                                .enum(["to-read", "reading", "finished"])
                                .safeParse(value);
                            if (result.success)
                                updateBook(id, {
                                    status: result.data,
                                    ...(result.data === "finished"
                                        ? { percent: 100 }
                                        : {}),
                                });
                        }}
                        items={statusItems}
                    >
                        <SelectTrigger aria-label="Reading status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {statusItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>
            <section className="mt-4 flex flex-col gap-3">
                <h2 className="type-heading">Passage notes and highlights</h2>
                {selection ? (
                    <div className="shell">
                        <div className="panel flex flex-col gap-3 p-3">
                            <blockquote className="type-body text-text-2">
                                {selection.quote}
                            </blockquote>
                            <Field>
                                <FieldLabel>Note on selected passage</FieldLabel>
                                <Textarea
                                    value={draft}
                                    onValueChange={setDraft}
                                    placeholder="What do you want to remember about this passage?"
                                />
                            </Field>
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => saveAnnotation("")}
                                >
                                    Keep highlight
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => saveAnnotation(draft)}
                                >
                                    Save passage note
                                </Button>
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
                        </div>
                    </div>
                ) : (
                    <p className="type-body-sm text-text-2">
                        Select text in the book to highlight it, attach a note,
                        or make a review card.
                    </p>
                )}
                {annotations.length > 0 && (
                    <ItemGroup aria-label="Saved passages">
                        {annotations.map((item) => (
                            <Item key={item.id}>
                                <ItemContent>
                                    <ItemTitle>
                                        <span>{item.data.quote}</span>
                                    </ItemTitle>
                                    {item.data.text && (
                                        <ItemDescription>{item.data.text}</ItemDescription>
                                    )}
                                </ItemContent>
                                <ItemActions>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (item.data.anchor.kind === "book")
                                                void display(item.data.anchor.cfi);
                                        }}
                                    >
                                        Return to passage
                                        <Icon icon={ArrowRight} />
                                    </Button>
                                </ItemActions>
                            </Item>
                        ))}
                    </ItemGroup>
                )}
            </section>
        </div>
    );
}
