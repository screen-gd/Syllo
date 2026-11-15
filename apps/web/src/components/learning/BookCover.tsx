import { useEffect, useState } from "react";
import type { LibraryBook } from "@/lib/personal/schema";
import { getLocalFile, saveLocalFile } from "@/lib/personal/files";
import { useCloudSync } from "@/components/sync/CloudSync";
import { cn } from "@/lib/utils";

/** A book's cover image, or a neutral placeholder with its title and author while none is stored. */
export default function BookCover({
    book,
    className = "",
    compact = false,
}: {
    book: LibraryBook;
    className?: string;
    /** A small tile with no text, for rows where the title sits beside it. */
    compact?: boolean;
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
    const frame = cn(
        "aspect-3/4 w-full overflow-hidden rounded-tag bg-field",
        className,
    );
    if (!url && compact) return <div className={frame} aria-hidden="true" />;
    return url ? (
        <img className={cn(frame, "object-cover")} src={url} alt="" />
    ) : (
        <div
            className={cn(
                frame,
                "flex flex-col items-center justify-center gap-0.5 p-1.5 text-center",
            )}
            aria-hidden="true"
        >
            <span className="line-clamp-3 type-caption text-text-1">
                {book.title}
            </span>
            <span className="line-clamp-1 type-caption text-text-2">
                {book.author}
            </span>
        </div>
    );
}
