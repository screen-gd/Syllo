"use client";

import { useState } from "react";
import type { ResourceSection, Section, Resource } from "@/types";
import ContentViewer from "@/components/shared/ContentViewer";
import { AnimatePresence } from "motion/react";

interface Props {
    section: ResourceSection;
    onUpdate: (updater: (s: Section) => Section) => void;
}

export default function Resources({ section }: Props) {
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);

    const getIcon = (type: string) => {
        switch (type) {
            case "doc": return <span className="text-accent">📄</span>;
            case "video": return <span className="text-danger">🎥</span>;
            case "tool": return <span className="text-warning">🔧</span>;
            case "course": return <span className="text-accent">🎓</span>;
            case "book": return <span className="text-accent">📚</span>;
            case "pdf": return <span className="text-danger">📑</span>;
            case "link":
            default: return <span className="text-accent">🔗</span>;
        }
    };

    const categories = Array.from(new Set(section.data.map((r: Resource) => r.category || "Uncategorized"))).sort();

    return (
        <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center sm:text-left">
                <h2 className="font-display text-4xl font-semibold text-text mb-3">
                    📚 {section.title}
                </h2>
                <p className="text-text-muted text-base">Curated materials to accelerate your learning.</p>
            </div>

            <div className="space-y-12">
                {categories.map((category) => {
                    const catResources = section.data.filter((r: Resource) => (r.category || "Uncategorized") === category);
                    return (
                        <div key={category}>
                            <div className="flex items-center gap-3 mb-6 px-2 sm:px-0">
                                <h3 className="font-display font-bold text-text text-lg text-text-muted">{category}</h3>
                                <div className="flex-1 h-px bg-surface-muted" />
                                <span className="text-[0.75rem] font-bold text-text bg-surface-muted px-2 py-0.5 rounded">{catResources.length} items</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {catResources.map((res: Resource) => (
                                    <button
                                        key={res.id}
                                        onClick={() => setViewerUrl(res.url)}
                                        className="group relative flex flex-col p-5 rounded-2xl surface border border-border text-left transition-colors hover:bg-surface-subtle overflow-hidden"
                                    >
                                        {/* Hover Glow Background */}
                                        <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                        <div className="flex items-start justify-between mb-4 relative z-10 w-full gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-page flex items-center justify-center text-xl shrink-0 border border-border">
                                                {getIcon(res.type)}
                                            </div>
                                            <span className="text-[0.75rem] font-bold text-text-muted bg-surface px-2 py-1 rounded">
                                                {res.type}
                                            </span>
                                        </div>

                                        <div className="relative z-10 flex flex-col flex-1">
                                            <h4 className="font-display font-bold text-base text-text mb-2 line-clamp-2 leading-snug group-hover:text-accent-strong transition-colors">
                                                {res.title}
                                            </h4>
                                            <p className="text-sm text-text-muted line-clamp-2 mt-auto">
                                                {res.description}
                                            </p>
                                        </div>

                                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity relative z-10 text-accent mt-4 text-sm font-bold flex items-center gap-1 w-full justify-end">
                                            Open <span>→</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {viewerUrl && (
                    <ContentViewer
                        url={viewerUrl}
                        onClose={() => setViewerUrl(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
