"use client";

import { useEffect, useCallback } from "react";

interface ContentViewerProps {
    url: string;
    title?: string;
    onClose: () => void;
}

export default function ContentViewer({ url, title, onClose }: ContentViewerProps) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    const isPdf = url.toLowerCase().endsWith(".pdf");

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                role="presentation"
            />

            {/* Panel */}
            <div
                className="relative ml-auto w-full max-w-4xl h-full bg-obsidian-light border-l border-border flex flex-col animate-slide-in-right"
                style={{ overscrollBehavior: "contain" }}
            >
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-obsidian-surface">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-white/20" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <p className="text-text-secondary text-sm truncate flex-1">
                            {title || url}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost text-xs py-1 px-2"
                            aria-label="Open in new tab"
                        >
                            ↗ Open externally
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost text-xs py-1 px-2"
                            aria-label="Close viewer"
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {isPdf ? (
                        <iframe
                            src={url}
                            title={title || "PDF Viewer"}
                            className="w-full h-full"
                            loading="lazy"
                        />
                    ) : (
                        <iframe
                            src={url}
                            title={title || "Content Viewer"}
                            className="w-full h-full bg-white"
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            loading="lazy"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
