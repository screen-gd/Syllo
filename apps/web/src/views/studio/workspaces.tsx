import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import WorkspaceLibraryCard from "@/components/workspaces/WorkspaceLibraryCard";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { getStorage } from "@/lib/storage";
import { getRoadmapStats } from "@/lib/workspace-stats";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";

type LibraryFilter = "all" | "in-progress" | "completed";
type SortMode = "recent" | "title" | "completion";

export default function WorkspacesPage() {
    const { roadmaps, loaded: mounted } = useLearningRoadmaps();
    const [filter, setFilter] = useState<LibraryFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("recent");

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
                return (
                    getRoadmapStats(right).percent -
                    getRoadmapStats(left).percent
                );
            }

            const leftDate = new Date(
                left.updatedAt || left.createdAt,
            ).getTime();
            const rightDate = new Date(
                right.updatedAt || right.createdAt,
            ).getTime();
            return rightDate - leftDate;
        });

        return nextRoadmaps;
    }, [filter, roadmaps, sortMode]);

    const counts = useMemo(() => {
        const states = roadmaps.map(
            (roadmap) => getRoadmapStats(roadmap).progressState,
        );
        return {
            all: roadmaps.length,
            "in-progress": states.filter((state) => state === "in-progress")
                .length,
            completed: states.filter((state) => state === "completed").length,
        } satisfies Record<LibraryFilter, number>;
    }, [roadmaps]);

    const filterOptions = (
        [
            { key: "all", label: "All" },
            { key: "in-progress", label: "In progress" },
            { key: "completed", label: "Completed" },
        ] as const
    ).map((option) => ({
        key: option.key,
        label: mounted ? `${option.label} ${counts[option.key]}` : option.label,
    }));

    const sortOptions = [
        { key: "recent", label: "Recent" },
        { key: "title", label: "Title" },
        { key: "completion", label: "Progress" },
    ] as const satisfies readonly { key: SortMode; label: string }[];

    return (
        <div className="studio-page">
            <header className="sy-page-head">
                <div className="app-header-block">
                    <h1>Learning topics</h1>
                    <p className="text-sm text-text-muted">
                        Choose a topic to continue learning.
                    </p>
                </div>

                <Link to="/create" className="button-primary shrink-0">
                    <Plus size={16} />
                    Add roadmap
                </Link>
            </header>

            <div className="sy-toolbar">
                <Segmented
                    label="Filter workspaces"
                    value={filter}
                    options={filterOptions}
                    onChange={setFilter}
                />
                <Segmented
                    label="Sort workspaces"
                    value={sortMode}
                    options={sortOptions}
                    onChange={setSortMode}
                />
            </div>

            {mounted ? (
                filteredRoadmaps.length > 0 ? (
                    <div className="sy-workspace-list">
                        {filteredRoadmaps.map((roadmap) => (
                            <WorkspaceLibraryCard
                                key={roadmap.id}
                                roadmap={roadmap}
                                onDelete={(id) => {
                                    getStorage().deleteRoadmap(id);
                                }}
                                onRename={(id, nextTitle) => {
                                    getStorage().updateRoadmap(id, {
                                        title: nextTitle,
                                    });
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="sy-empty bordered sy-empty-row">
                        <p className="text-sm text-text-muted">
                            {roadmaps.length === 0
                                ? "No learning topics yet. Start with Scout or add your own roadmap."
                                : "No learning topic matches this filter."}
                        </p>
                        <div className="flex gap-2">
                            {roadmaps.length > 0 ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setFilter("all")}
                                >
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
                <p className="sy-loading" role="status">
                    Loading learning topics…
                </p>
            )}
        </div>
    );
}
