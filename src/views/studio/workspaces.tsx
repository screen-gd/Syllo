import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpDown, HardDrive, Plus, SlidersHorizontal } from "lucide-react";
import WorkspaceLibraryCard from "@/components/workspaces/WorkspaceLibraryCard";
import { Button } from "@/components/ui/button";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import type { Roadmap } from "@/types";

type LibraryFilter = "all" | "in-progress" | "completed";
type SortMode = "recent" | "title" | "completion";

export default function WorkspacesPage() {
    const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
    const [filter, setFilter] = useState<LibraryFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("recent");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const storage = getStorage();

        setMounted(true);
        setRoadmaps(storage.getRoadmaps());
    }, []);

    const filteredRoadmaps = useMemo(() => {
        const nextRoadmaps = [...roadmaps].filter((roadmap) => {
            if (filter === "all") return true;

            const stats = getRoadmapStats(roadmap);
            if (filter === "completed") {
                return stats.progressState === "completed";
            }

            return stats.progressState === "in-progress";
        });

        nextRoadmaps.sort((left, right) => {
            if (sortMode === "title") {
                return left.title.localeCompare(right.title);
            }

            if (sortMode === "completion") {
                return getRoadmapStats(right).percent - getRoadmapStats(left).percent;
            }

            const leftDate = new Date(left.updatedAt || left.createdAt).getTime();
            const rightDate = new Date(right.updatedAt || right.createdAt).getTime();
            return rightDate - leftDate;
        });

        return nextRoadmaps;
    }, [filter, roadmaps, sortMode]);

    const filterOptions: { key: LibraryFilter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "in-progress", label: "In progress" },
        { key: "completed", label: "Completed" },
    ];

    const sortOptions: { key: SortMode; label: string }[] = [
        { key: "recent", label: "Recent" },
        { key: "title", label: "Title" },
        { key: "completion", label: "Completion" },
    ];

    return (
        <div className="studio-page">
            <header className="app-header-block">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex max-w-2xl flex-col gap-1.5">
                        <h1>Workspaces</h1>
                        <p className="text-sm text-text-muted">Open, sort and continue your workspaces.</p>
                    </div>

                    <Link to="/create" className="button-primary shrink-0">
                        <Plus size={16} />
                        New workspace
                    </Link>
                </div>
            </header>

            <section className="section-space-compact">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                            <HardDrive size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-text">Local-only storage</p>
                            <p className="mt-1 text-sm leading-6 text-text-muted">
                                Everything stays in this browser. No account or cloud sync required.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-8 py-2">
                <div className="filter-bar">
                    <div className="flex flex-wrap items-center gap-5">
                        <div className="flex items-center gap-3 text-sm text-text-muted">
                            <SlidersHorizontal size={15} />
                            <span>Filter</span>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            {filterOptions.map((option) => (
                                <Button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setFilter(option.key)}
                                    variant={filter === option.key ? "default" : "ghost"}
                                    size="sm"
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                        <div className="flex items-center gap-3 text-sm text-text-muted">
                            <ArrowUpDown size={15} />
                            <span>Sort</span>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            {sortOptions.map((option) => (
                                <Button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setSortMode(option.key)}
                                    variant={sortMode === option.key ? "default" : "ghost"}
                                    size="sm"
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {mounted && filteredRoadmaps.length > 0 && (
                    <div className="flex items-center border-b border-border pb-3">
                        <div className="inline-flex items-center gap-3 text-xs font-semibold text-text">
                            <span>{filteredRoadmaps.length}</span>
                            <span>{filteredRoadmaps.length === 1 ? "workspace" : "workspaces"}</span>
                            {filter !== "all" && (
                                <span className="ml-1 text-text-muted">
                                    • {filterOptions.find(f => f.key === filter)?.label}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {mounted ? (
                    filteredRoadmaps.length > 0 ? (
                        <div className="space-y-0">
                            {filteredRoadmaps.map((roadmap) => (
                                <WorkspaceLibraryCard
                                    key={roadmap.id}
                                    roadmap={roadmap}
                                    onDelete={(id) => {
                                        getStorage().deleteRoadmap(id);
                                        setRoadmaps(getStorage().getRoadmaps());
                                    }}
                                    onRename={(id, nextTitle) => {
                                        getStorage().updateRoadmap(id, { title: nextTitle });
                                        setRoadmaps(getStorage().getRoadmaps());
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="studio-empty mt-8 py-12">
                            <h2 className="text-2xl font-display text-text">
                                {roadmaps.length === 0 ? "No workspaces yet." : "Nothing matches the current view."}
                            </h2>
                            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-muted">
                                {roadmaps.length === 0
                                    ? "Create the first workspace and it will appear here as a clean, sortable library."
                                    : "Adjust the filters or sorting to bring another set of workspaces back into view."}
                            </p>
                            <div className="mt-6 flex justify-center gap-3">
                                <Button asChild>
                                    <Link to="/create">
                                        <Plus size={16} />
                                        New workspace
                                    </Link>
                                </Button>
                                {roadmaps.length > 0 ? (
                                    <Button type="button" variant="secondary" onClick={() => setFilter("all")}>
                                        Show all
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    )
                ) : (
                    <div className="space-y-0 border-t border-border">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-40 border-b border-border skeleton" />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
