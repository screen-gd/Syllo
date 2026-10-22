import { useEffect, useState, type CSSProperties } from "react";
import type { LibraryBook } from "@/lib/personal/schema";
import { getLocalFile, saveLocalFile } from "@/lib/personal/files";
import { useCloudSync } from "@/components/sync/CloudSync";

export default function BookCover({
    book,
    className = "",
}: {
    book: LibraryBook;
    className?: string;
}) {
    const [url, setUrl] = useState<string | null>(null);
    const { downloadFile } = useCloudSync();
    useEffect(() => {
        if (!book.coverKey) return;
        let active = true;
        let objectUrl: string | null = null;
        const key = book.coverKey;
        void (async () => {
            let file = await getLocalFile(key);
            if (!file && book.cloudCoverId && downloadFile) {
                file = await downloadFile(book.cloudCoverId);
                await saveLocalFile(key, file);
            }
            if (file && active) {
                objectUrl = URL.createObjectURL(file);
                setUrl(objectUrl);
            }
        })().catch(() => {});
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [book.coverKey, book.cloudCoverId, downloadFile]);
    return url ? (
        <img className={`sy-book-cover ${className}`} src={url} alt="" />
    ) : (
        <div
            className={`sy-book-cover sy-book-cover-type ${className}`}
            style={{ backgroundColor: book.color } satisfies CSSProperties}
            aria-hidden="true"
        >
            <span>{book.title}</span>
            <small>{book.author}</small>
        </div>
    );
}
