import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import WorkspaceLibraryCard from "@/components/workspaces/WorkspaceLibraryCard";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
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

    const counts = useMemo(() => {
        const states = roadmaps.map((roadmap) => getRoadmapStats(roadmap).progressState);
        return {
            all: roadmaps.length,
            "in-progress": states.filter((state) => state === "in-progress").length,
            completed: states.filter((state) => state === "completed").length,
        } satisfies Record<LibraryFilter, number>;
    }, [roadmaps]);

    const filterOptions = (
        [
            { key: "all", label: "All" },
            { key: "in-progress", label: "In progress" },
            { key: "completed", label: "Completed" },
        ] as const
    ).map((option) => ({ key: option.key, label: mounted ? `${option.label} ${counts[option.key]}` : option.label }));

    const sortOptions = [
        { key: "recent", label: "Recent" },
        { key: "title", label: "Title" },
        { key: "completion", label: "Progress" },
    ] as const satisfies readonly { key: SortMode; label: string }[];

    return (
        <div className="studio-page">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="app-header-block">
                    <h1>Workspaces</h1>
                    <p className="text-sm text-text-muted">Saved in this browser. Nothing is synced.</p>
                </div>

                <Link to="/create" className="button-primary shrink-0">
                    <Plus size={16} />
                    New workspace
                </Link>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented label="Filter workspaces" value={filter} options={filterOptions} onChange={setFilter} />
                <Segmented label="Sort workspaces" value={sortMode} options={sortOptions} onChange={setSortMode} />
            </div>

            {mounted ? (
                filteredRoadmaps.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl bg-surface">
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
                    <div className="studio-empty flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                        <p className="text-sm text-text-muted">
                            {roadmaps.length === 0
                                ? "No workspaces yet. Create one from a guide, or let Scout build one."
                                : "No workspace matches this filter."}
                        </p>
                        <div className="flex gap-2">
                            {roadmaps.length > 0 ? (
                                <Button type="button" variant="secondary" size="sm" onClick={() => setFilter("all")}>
                                    Show all
                                </Button>
                            ) : (
                                <Button asChild variant="secondary" size="sm">
                                    <Link to="/scout">Open Scout</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )
            ) : (
                <div className="skeleton h-64 rounded-2xl" aria-hidden="true" />
            )}
        </div>
    );
}
