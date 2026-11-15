import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Add, Icon } from "@/components/glaze/icon";
import { Button } from "@/components/glaze/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { ItemGroup } from "@/components/glaze/ui/item";
import {
    SegmentedControl,
    SegmentedControlItem,
} from "@/components/glaze/ui/segmented-control";
import { SkeletonText } from "@/components/glaze/ui/skeleton";
import WorkspaceLibraryCard from "@/components/workspaces/WorkspaceLibraryCard";
import PageFrame from "@/components/layout/PageFrame";
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

    return (
        <PageFrame
            title="Learning topics"
            subtitle="Choose a topic to continue learning."
            actions={
                <Button
                    render={<Link to="/create" />}
                    nativeButton={false}
                >
                    <Icon icon={Add} />
                    Add roadmap
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                        aria-label="Filter workspaces"
                        value={filter}
                        onValueChange={(value) =>
                            setFilter(value as LibraryFilter)
                        }
                    >
                        <SegmentedControlItem
                            value="all"
                            count={mounted ? counts.all : undefined}
                        >
                            All
                        </SegmentedControlItem>
                        <SegmentedControlItem
                            value="in-progress"
                            count={mounted ? counts["in-progress"] : undefined}
                        >
                            In progress
                        </SegmentedControlItem>
                        <SegmentedControlItem
                            value="completed"
                            count={mounted ? counts.completed : undefined}
                        >
                            Completed
                        </SegmentedControlItem>
                    </SegmentedControl>
                    <SegmentedControl
                        aria-label="Sort workspaces"
                        value={sortMode}
                        onValueChange={(value) =>
                            setSortMode(value as SortMode)
                        }
                    >
                        <SegmentedControlItem value="recent">
                            Recent
                        </SegmentedControlItem>
                        <SegmentedControlItem value="title">
                            Title
                        </SegmentedControlItem>
                        <SegmentedControlItem value="completion">
                            Progress
                        </SegmentedControlItem>
                    </SegmentedControl>
                </div>

                {mounted ? (
                    filteredRoadmaps.length > 0 ? (
                        <section className="shell">
                            <div className="panel">
                                <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                    <h2 className="type-heading-sm">Topics</h2>
                                    <span className="type-caption text-text-2">
                                        {filteredRoadmaps.length}
                                    </span>
                                </header>
                                <ItemGroup variant="plain" className="px-1 pb-1">
                                    {filteredRoadmaps.map((roadmap) => (
                                        <WorkspaceLibraryCard
                                            key={roadmap.id}
                                            roadmap={roadmap}
                                            onDelete={(id) => {
                                                getStorage().deleteRoadmap(id);
                                            }}
                                            onRename={(id, nextTitle) => {
                                                getStorage().updateRoadmap(
                                                    id,
                                                    {
                                                        title: nextTitle,
                                                    },
                                                );
                                            }}
                                        />
                                    ))}
                                </ItemGroup>
                            </div>
                        </section>
                    ) : (
                        <Empty reason="empty">
                            <EmptyHeader>
                                <EmptyTitle>
                                    {roadmaps.length === 0
                                        ? "No learning topics yet"
                                        : "No learning topic matches this filter"}
                                </EmptyTitle>
                            </EmptyHeader>
                            <EmptyContent>
                                {roadmaps.length === 0 ? (
                                    <>
                                        <p className="type-body-sm text-text-2">
                                            Start with Scout or add your own
                                            roadmap.
                                        </p>
                                        <Button
                                            className="mt-3"
                                            variant="secondary"
                                            render={<Link to="/scout" />}
                                            nativeButton={false}
                                        >
                                            Open Scout
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setFilter("all")}
                                    >
                                        Show all
                                    </Button>
                                )}
                            </EmptyContent>
                        </Empty>
                    )
                ) : (
                    <section className="shell">
                        <div className="panel">
                            <header className="flex items-center justify-between gap-3 p-4 pb-3">
                                <h2 className="type-heading-sm">Topics</h2>
                            </header>
                            <div
                                className="flex flex-col gap-3 px-4 pb-4"
                                role="status"
                                aria-label="Loading"
                            >
                                <span className="sr-only">Loading</span>
                                {[0, 1, 2].map((row) => (
                                    <SkeletonText
                                        key={row}
                                        type="body"
                                        last={0.4}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </PageFrame>
    );
}
