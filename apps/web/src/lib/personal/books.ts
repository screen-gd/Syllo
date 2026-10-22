import { getLocalFile, saveLocalFile } from "./files";
import {
    personalEntries,
    getPersonalSnapshot,
    putPersonalEntry,
} from "./store";
import type { LibraryBook } from "./schema";

export const MAX_BOOK_BYTES = 50 * 1024 * 1024;
const colors = [
    "#c6d2c0",
    "#b9cbd8",
    "#c6b1b3",
    "#69746c",
    "#9d7e68",
    "#b8b4a8",
];

export function saveBook(book: LibraryBook) {
    putPersonalEntry({
        kind: "book",
        id: `book:${book.id}`,
        data: book,
        updatedAt: Date.now(),
        deleted: false,
    });
}

export function findBook(id: string) {
    const entry = getPersonalSnapshot()[`book:${id}`];
    return entry?.kind === "book" && !entry.deleted ? entry.data : null;
}

export function updateBook(id: string, updates: Partial<LibraryBook>) {
    const book = findBook(id);
    if (book) saveBook({ ...book, ...updates });
}

/** Metadata and contents come from the imported EPUB, never an inferred chapter list. */
export async function importEpub(
    file: Pick<File, "name" | "size" | "type" | "arrayBuffer">,
): Promise<LibraryBook> {
    if (!file.name.toLowerCase().endsWith(".epub"))
        throw new Error("Choose an EPUB file.");
    if (file.size > MAX_BOOK_BYTES)
        throw new Error("Choose an EPUB smaller than 50 MB.");
    const buffer = await file.arrayBuffer();
    const cachedFile = new Blob([buffer], { type: "application/epub+zip" });
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
    const existing = personalEntries(getPersonalSnapshot(), "book").find(
        (item) => item.data.fingerprint === fingerprint,
    );
    if (existing) {
        await saveLocalFile(existing.data.fileKey, cachedFile);
        return existing.data;
    }
    const { default: ePub } = await import("epubjs");
    const epub = ePub();
    try {
        await epub.open(buffer, "binary");
        const metadata = await epub.loaded.metadata;
        const id = crypto.randomUUID();
        const fileKey = `epub:${id}`;
        await saveLocalFile(fileKey, cachedFile);
        let coverKey: string | null = null;
        const coverUrl = await epub.coverUrl().catch(() => null);
        if (coverUrl) {
            try {
                const response = await fetch(coverUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    if (
                        blob.type.startsWith("image/") &&
                        blob.size < 5 * 1024 * 1024
                    ) {
                        coverKey = `cover:${id}`;
                        await saveLocalFile(coverKey, blob);
                    }
                }
            } catch {
                /* A missing cover never blocks reading the book. */
            }
        }
        const count = personalEntries(getPersonalSnapshot(), "book").length;
        const book: LibraryBook = {
            id,
            title: metadata.title?.trim() || file.name.replace(/\.epub$/i, ""),
            author: metadata.creator?.trim() || "Unknown author",
            category: "Uncategorized",
            status: "to-read",
            fileName: file.name,
            fileSize: file.size,
            fingerprint,
            coverKey,
            fileKey,
            cloudFileId: null,
            cloudCoverId: null,
            position: null,
            chapter: "Not started",
            percent: 0,
            locations: null,
            addedAt: new Date().toISOString(),
            lastReadAt: null,
            color: colors[count % colors.length],
        };
        saveBook(book);
        return book;
    } catch (error) {
        if (error instanceof Error && /space|storage/i.test(error.message))
            throw error;
        throw new Error(
            "This EPUB could not be opened. Try a valid, DRM-free copy.",
        );
    } finally {
        epub.destroy();
    }
}

export async function getBookFile(
    book: LibraryBook,
    download?: (id: string) => Promise<Blob>,
) {
    const cached = await getLocalFile(book.fileKey);
    if (cached) return cached;
    if (!book.cloudFileId || !download)
        throw new Error(
            "This book is not downloaded on this device. Connect sync or import the same EPUB again.",
        );
    const file = await download(book.cloudFileId);
    await saveLocalFile(book.fileKey, file);
    return file;
}
