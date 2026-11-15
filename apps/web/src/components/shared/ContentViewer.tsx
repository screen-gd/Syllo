"use client";

import { External, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/glaze/ui/sheet";

interface ContentViewerProps {
    /** The page to show. null keeps the sheet closed, so it can animate out. */
    url: string | null;
    title?: string;
    onClose: () => void;
}

/**
 * Opens a resource in a side sheet over the page, with a link to open it in a new tab.
 * Render it always and pass url=null to close it.
 */
export default function ContentViewer({ url, title, onClose }: ContentViewerProps) {
    const isPdf = url?.toLowerCase().endsWith(".pdf") ?? false;

    return (
        <Sheet open={url !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{title || url}</SheetTitle>
                </SheetHeader>
                <SheetBody className="flex min-h-0 flex-1 flex-col">
                    {url ? (
                        <div className="min-h-0 flex-1 overflow-hidden rounded-panel border border-line-faint">
                            {isPdf ? (
                                <iframe
                                    src={url}
                                    title={title || "PDF viewer"}
                                    className="size-full"
                                    loading="lazy"
                                />
                            ) : (
                                <iframe
                                    src={url}
                                    title={title || "Content viewer"}
                                    className="size-full bg-paper"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                    loading="lazy"
                                />
                            )}
                        </div>
                    ) : null}
                </SheetBody>
                <SheetFooter>
                    <SheetClose>Close</SheetClose>
                    {url ? (
                        <Button
                            size="sm"
                            nativeButton={false}
                            render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                        >
                            Open in new tab
                            <Icon icon={External} />
                        </Button>
                    ) : null}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
